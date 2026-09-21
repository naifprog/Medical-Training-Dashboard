import express from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { serializeMe } from "../utils/serialize.js";
import { validatePasswordPolicy } from "../utils/password.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const result = await query(
    `SELECT u.id, u.password_hash, u.active
     FROM users u WHERE u.email = $1`,
    [String(email).trim().toLowerCase()]
  );
  const row = result.rows[0];
  if (!row) return res.status(401).json({ error: "Invalid email or password." });
  if (!row.active) return res.status(403).json({ error: "This account has been deactivated." });

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password." });

  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [row.id]);

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not start session." });
    req.session.userId = row.id;
    req.session.save(async (err2) => {
      if (err2) return res.status(500).json({ error: "Could not start session." });
      const meResult = await query(
        `SELECT u.id, u.full_name, u.employee_id, u.email, u.mobile, u.job_title,
                u.department_id, d.name AS department_name,
                u.must_change_password, u.role_id, r.name AS role_name,
                r.permissions AS role_permissions, u.permission_overrides, u.last_login_at
         FROM users u JOIN roles r ON r.id = u.role_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.id = $1`,
        [row.id]
      );
      const u = meResult.rows[0];
      res.json({
        user: serializeMe({
          id: u.id,
          fullName: u.full_name,
          employeeId: u.employee_id,
          email: u.email,
          mobile: u.mobile,
          jobTitle: u.job_title,
          departmentId: u.department_id,
          departmentName: u.department_name,
          mustChangePassword: u.must_change_password,
          roleId: u.role_id,
          roleName: u.role_name,
          permissions: { ...u.role_permissions, ...u.permission_overrides },
          lastLoginAt: u.last_login_at,
        }),
      });
    });
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("medtrain.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: serializeMe(req.user) });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required." });
  }
  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) return res.status(400).json({ error: policyError });

  const result = await query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  const row = result.rows[0];
  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect." });

  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    "UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2",
    [hash, req.user.id]
  );
  res.json({ ok: true });
});

export default router;
