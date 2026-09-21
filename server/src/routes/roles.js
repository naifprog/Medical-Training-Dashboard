import express from "express";
import { query } from "../db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { allPermissionKeys, isValidPermissionKey } from "../services/permissions.js";

const router = express.Router();

function sanitizePermissions(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, val] of Object.entries(input)) {
    if (isValidPermissionKey(key) && val) out[key] = true;
  }
  return out;
}

router.get("/", requireAuth, async (req, res) => {
  const result = await query("SELECT id, name, permissions, is_system, created_at FROM roles ORDER BY name");
  res.json({ roles: result.rows, permissionCatalog: allPermissionKeys() });
});

router.post("/", requireAuth, requirePermission("users.rolesCreate"), async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Role name is required." });
  const permissions = sanitizePermissions(req.body?.permissions);
  try {
    const result = await query(
      "INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING id, name, permissions, is_system, created_at",
      [name, JSON.stringify(permissions)]
    );
    res.status(201).json({ role: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A role with this name already exists." });
    throw err;
  }
});

router.put("/:id", requireAuth, requirePermission("users.rolesEdit"), async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Role name is required." });
  const permissions = sanitizePermissions(req.body?.permissions);
  const result = await query(
    "UPDATE roles SET name = $1, permissions = $2 WHERE id = $3 RETURNING id, name, permissions, is_system, created_at",
    [name, JSON.stringify(permissions), req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Role not found." });
  res.json({ role: result.rows[0] });
});

router.delete("/:id", requireAuth, requirePermission("users.rolesDelete"), async (req, res) => {
  const inUse = await query("SELECT count(*)::int AS n FROM users WHERE role_id = $1", [req.params.id]);
  if (inUse.rows[0].n > 0) {
    return res.status(409).json({ error: "Users with this role must be reassigned first.", userCount: inUse.rows[0].n });
  }
  const role = await query("SELECT is_system FROM roles WHERE id = $1", [req.params.id]);
  if (!role.rows.length) return res.status(404).json({ error: "Role not found." });
  const result = await query("DELETE FROM roles WHERE id = $1 RETURNING id", [req.params.id]);
  res.json({ ok: true, deleted: result.rows.length > 0 });
});

export default router;
