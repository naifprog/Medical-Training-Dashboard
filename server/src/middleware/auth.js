import { query } from "../db.js";
import { effectivePermissions, can as hasPerm } from "../services/permissions.js";

export async function loadUser(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    req.user = null;
    return next();
  }
  const result = await query(
    `SELECT u.id, u.full_name, u.employee_id, u.email, u.mobile, u.job_title,
            u.department_id, d.name AS department_name,
            u.must_change_password, u.active, u.role_id, r.name AS role_name,
            r.permissions AS role_permissions, u.permission_overrides,
            u.last_login_at, u.created_by, u.created_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row || !row.active) {
    req.user = null;
    return next();
  }
  const effective = effectivePermissions(row.role_permissions, row.permission_overrides);
  req.user = {
    id: row.id,
    fullName: row.full_name,
    employeeId: row.employee_id,
    email: row.email,
    mobile: row.mobile,
    jobTitle: row.job_title,
    departmentId: row.department_id,
    departmentName: row.department_name,
    mustChangePassword: row.must_change_password,
    active: row.active,
    roleId: row.role_id,
    roleName: row.role_name,
    permissions: effective,
    lastLoginAt: row.last_login_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

export function requirePermission(key) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!hasPerm(req.user.permissions, key)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export function requireAnyPermission(...keys) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!keys.some((k) => hasPerm(req.user.permissions, k))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
