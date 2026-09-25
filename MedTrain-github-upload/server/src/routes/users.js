import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { requireAuth, requirePermission, requireAnyPermission } from "../middleware/auth.js";
import { serializeUserRow } from "../utils/serialize.js";
import { generateTempPassword, validatePasswordPolicy } from "../utils/password.js";
import { isValidPermissionKey } from "../services/permissions.js";
import { canSeeAllTrainees } from "../services/traineeScope.js";
import { createAuthToken } from "../services/authTokens.js";
import { sendMail, isEmailConfigured } from "../services/email.js";
import { recordAudit } from "../services/audit.js";

const router = express.Router();

const USER_SELECT = `
  SELECT u.id, u.full_name, u.employee_id, u.email, u.mobile, u.job_title,
         u.department_id, d.name AS department_name,
         u.must_change_password, u.active, u.role_id, r.name AS role_name,
         u.permission_overrides, u.last_login_at, u.created_by,
         cb.full_name AS created_by_name, u.created_at,
         u.trainer_id, tr.full_name AS trainer_name
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN users cb ON cb.id = u.created_by
  LEFT JOIN users tr ON tr.id = u.trainer_id
`;

/** Validates that trainerId (if provided) references an active user whose role is "Trainer". */
async function validateTrainerId(trainerId) {
  if (trainerId === undefined || trainerId === null || trainerId === "") return null;
  const result = await query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.active = true AND r.name = 'Trainer'`,
    [trainerId]
  );
  if (!result.rows.length) {
    const err = new Error("trainerId must reference an active Trainer.");
    err.status = 400;
    throw err;
  }
  return trainerId;
}

function sanitizeOverrides(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, val] of Object.entries(input)) {
    if (isValidPermissionKey(key)) out[key] = !!val;
  }
  return out;
}

router.get(
  "/",
  requireAuth,
  requireAnyPermission("users.view", "trainees.view", "trainees.viewAll", "devices.assign"),
  async (req, res) => {
    const search = (req.query.q || "").trim();
    const params = [];
    const conditions = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.employee_id ILIKE $${params.length})`
      );
    }
    if (!canSeeAllTrainees(req.user)) {
      params.push(req.user.id);
      conditions.push(`u.trainer_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await query(`${USER_SELECT} ${where} ORDER BY u.full_name`, params);
    res.json({ users: result.rows.map(serializeUserRow) });
  }
);

router.get(
  "/:id",
  requireAuth,
  requireAnyPermission("users.view", "trainees.view", "trainees.viewAll"),
  async (req, res) => {
    const result = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "User not found." });
    const row = result.rows[0];
    if (!canSeeAllTrainees(req.user) && row.trainer_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({ user: serializeUserRow(row) });
  }
);

router.post("/", requireAuth, requirePermission("users.create"), async (req, res) => {
  const { fullName, email, departmentId, roleId, employeeId, mobile, jobTitle, active, permissionOverrides, trainerId } =
    req.body || {};
  if (!fullName?.trim() || !email?.trim() || !roleId) {
    return res.status(400).json({ error: "Full name, email and role are required." });
  }
  if (!req.user.permissions["users.rolesAssign"] && Object.keys(permissionOverrides || {}).length) {
    return res.status(403).json({ error: "You cannot assign individual permission overrides." });
  }

  let validTrainerId;
  try {
    validTrainerId = await validateTrainerId(trainerId);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  // The user never learns this placeholder -- they choose their own
  // password during activation. It only exists to satisfy the NOT NULL
  // constraint on password_hash until then.
  const placeholderPassword = generateTempPassword();
  const hash = await bcrypt.hash(placeholderPassword, 12);
  const overrides = sanitizeOverrides(permissionOverrides);

  try {
    const result = await query(
      `INSERT INTO users (full_name, email, department_id, role_id, employee_id, mobile, job_title,
                           active, permission_overrides, password_hash, must_change_password, created_by, trainer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12)
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
        validTrainerId,
      ]
    );
    const created = await query(`${USER_SELECT} WHERE u.id = $1`, [result.rows[0].id]);
    await recordAudit(req.user.id, "user.created", "user", result.rows[0].id, {});

    const rawToken = await createAuthToken(result.rows[0].id, "invite");
    const origin = process.env.APP_ORIGIN || "http://localhost:5173";
    const activationUrl = `${origin}/activate?token=${rawToken}`;
    let emailSent = false;
    try {
      await sendMail({
        to: created.rows[0].email,
        subject: "Set up your MedTrain account",
        html: `<a href="${activationUrl}">Set up your account</a>`,
        devUrl: activationUrl,
      });
      emailSent = isEmailConfigured();
    } catch (err) {
      console.error("account activation email failed:", err.message);
    }

    res.status(201).json({
      user: serializeUserRow(created.rows[0]),
      emailSent,
      // Dev-only convenience while no real email provider is configured --
      // never included in a production response.
      activationUrl: process.env.NODE_ENV === "production" ? undefined : activationUrl,
    });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A user with this email already exists." });
    throw err;
  }
});

router.put("/:id", requireAuth, requirePermission("users.edit"), async (req, res) => {
  const existing = await query("SELECT id, role_id FROM users WHERE id = $1", [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: "User not found." });

  const { fullName, email, departmentId, roleId, employeeId, mobile, jobTitle, permissionOverrides, trainerId } = req.body || {};
  if (!req.user.permissions["users.rolesAssign"] && permissionOverrides !== undefined) {
    return res.status(403).json({ error: "You cannot assign individual permission overrides." });
  }

  // trainer_id is only ever meaningful for a Trainee. Resolve the role this
  // user will have AFTER this update (the incoming roleId if it's being
  // changed, otherwise their current one) so a role change away from
  // Trainee can never leave a stale/invalid trainer relationship behind --
  // regardless of whether the request even touched trainerId at all.
  const effectiveRoleId = roleId !== undefined ? roleId : existing.rows[0].role_id;
  const effectiveRole = await query("SELECT name FROM roles WHERE id = $1", [effectiveRoleId]);
  const isTrainee = effectiveRole.rows[0]?.name === "Trainee";

  let validTrainerId = null;
  if (isTrainee && trainerId !== undefined) {
    try {
      validTrainerId = await validateTrainerId(trainerId);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
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
  let trainerChanged = false;
  if (!isTrainee) {
    // Effective role (new or unchanged) is not Trainee: force-clear
    // trainer_id no matter what was sent, so it's never left stale.
    set("trainer_id", null);
    trainerChanged = true;
  } else if (trainerId !== undefined) {
    set("trainer_id", validTrainerId);
    trainerChanged = true;
  }
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
  if (trainerChanged) {
    await recordAudit(req.user.id, "user.trainer_changed", "user", req.params.id, { trainerId: validTrainerId });
  } else {
    await recordAudit(req.user.id, "user.updated", "user", req.params.id, {});
  }
  res.json({ user: serializeUserRow(updated.rows[0]) });
});

router.post("/:id/deactivate", requireAuth, requirePermission("trainees.deactivate"), async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You cannot deactivate your own account." });
  await query("UPDATE users SET active = false, updated_at = now() WHERE id = $1", [req.params.id]);
  await recordAudit(req.user.id, "user.deactivated", "user", req.params.id, {});
  res.json({ ok: true });
});

router.post("/:id/activate", requireAuth, requirePermission("trainees.deactivate"), async (req, res) => {
  await query("UPDATE users SET active = true, updated_at = now() WHERE id = $1", [req.params.id]);
  await recordAudit(req.user.id, "user.activated", "user", req.params.id, {});
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
