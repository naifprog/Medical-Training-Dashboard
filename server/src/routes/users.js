import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { requireAuth, requirePermission, requireAnyPermission } from "../middleware/auth.js";
import { serializeUserRow } from "../utils/serialize.js";
import { generateTempPassword, validatePasswordPolicy } from "../utils/password.js";
import { isValidPermissionKey } from "../services/permissions.js";

const router = express.Router();

const USER_SELECT = `
  SELECT u.id, u.full_name, u.employee_id, u.email, u.mobile, u.job_title,
         u.department_id, d.name AS department_name,
         u.must_change_password, u.active, u.role_id, r.name AS role_name,
         u.permission_overrides, u.last_login_at, u.created_by,
         cb.full_name AS created_by_name, u.created_at
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN users cb ON cb.id = u.created_by
`;

function sanitizeOverrides(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, val] of Object.entries(input)) {
    if (isValidPermissionKey(key)) out[key] = !!val;
  }
  return out;
}

router.get("/", requireAuth, requireAnyPermission("users.view", "devices.assign"), async (req, res) => {
  const search = (req.query.q || "").trim();
  const params = [];
  let where = "";
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.employee_id ILIKE $${params.length}`;
  }
  const result = await query(`${USER_SELECT} ${where} ORDER BY u.full_name`, params);
  res.json({ users: result.rows.map(serializeUserRow) });
});

router.get("/:id", requireAuth, requirePermission("users.view"), async (req, res) => {
  const result = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: "User not found." });
  res.json({ user: serializeUserRow(result.rows[0]) });
});

router.post("/", requireAuth, requirePermission("users.create"), async (req, res) => {
  const { fullName, email, departmentId, roleId, employeeId, mobile, jobTitle, active, permissionOverrides } =
    req.body || {};
  if (!fullName?.trim() || !email?.trim() || !roleId) {
    return res.status(400).json({ error: "Full name, email and role are required." });
  }
  if (!req.user.permissions["users.rolesAssign"] && Object.keys(permissionOverrides || {}).length) {
    return res.status(403).json({ error: "You cannot assign individual permission overrides." });
  }

  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 12);
  const overrides = sanitizeOverrides(permissionOverrides);

  try {
    const result = await query(
      `INSERT INTO users (full_name, email, department_id, role_id, employee_id, mobile, job_title,
                           active, permission_overrides, password_hash, must_change_password, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)
       RETURNING id`,
      [
        fullName.trim(),
        email.trim().toLowerCase(),
        departmentId || null,
        roleId,
        employeeId?.trim() || null,
        mobile?.trim() || null,
        jobTitle?.trim() || null,
        active !== false,
        JSON.stringify(overrides),
        hash,
        req.user.id,
      ]
    );
    const created = await query(`${USER_SELECT} WHERE u.id = $1`, [result.rows[0].id]);
    res.status(201).json({ user: serializeUserRow(created.rows[0]), tempPassword });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A user with this email already exists." });
    throw err;
  }
});

router.put("/:id", requireAuth, requirePermission("users.edit"), async (req, res) => {
  const existing = await query("SELECT id FROM users WHERE id = $1", [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: "User not found." });

  const { fullName, email, departmentId, roleId, employeeId, mobile, jobTitle, permissionOverrides } = req.body || {};
  if (!req.user.permissions["users.rolesAssign"] && permissionOverrides !== undefined) {
    return res.status(403).json({ error: "You cannot assign individual permission overrides." });
  }

  const fields = [];
  const params = [];
  function set(col, val) {
    params.push(val);
    fields.push(`${col} = $${params.length}`);
  }
  if (fullName !== undefined) set("full_name", fullName.trim());
  if (email !== undefined) set("email", email.trim().toLowerCase());
  if (departmentId !== undefined) set("department_id", departmentId || null);
  if (roleId !== undefined) set("role_id", roleId);
  if (employeeId !== undefined) set("employee_id", employeeId?.trim() || null);
  if (mobile !== undefined) set("mobile", mobile?.trim() || null);
  if (jobTitle !== undefined) set("job_title", jobTitle?.trim() || null);
  if (permissionOverrides !== undefined) set("permission_overrides", JSON.stringify(sanitizeOverrides(permissionOverrides)));
  set("updated_at", new Date());

  if (!fields.length) return res.status(400).json({ error: "Nothing to update." });
  params.push(req.params.id);

  try {
    await query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${params.length}`, params);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A user with this email already exists." });
    throw err;
  }
  const updated = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);
  res.json({ user: serializeUserRow(updated.rows[0]) });
});

router.post("/:id/deactivate", requireAuth, requirePermission("trainees.deactivate"), async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You cannot deactivate your own account." });
  await query("UPDATE users SET active = false, updated_at = now() WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

router.post("/:id/activate", requireAuth, requirePermission("trainees.deactivate"), async (req, res) => {
  await query("UPDATE users SET active = true, updated_at = now() WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

router.post("/:id/reset-password", requireAuth, requirePermission("users.edit"), async (req, res) => {
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 12);
  const result = await query(
    "UPDATE users SET password_hash = $1, must_change_password = true, updated_at = now() WHERE id = $2 RETURNING id",
    [hash, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "User not found." });
  res.json({ ok: true, tempPassword });
});

export default router;
