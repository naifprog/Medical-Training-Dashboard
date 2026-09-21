import express from "express";
import { query } from "../db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const result = await query("SELECT id, name, created_at FROM departments ORDER BY name");
  res.json({ departments: result.rows });
});

router.post("/", requireAuth, requirePermission("devices.create"), async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Department name is required." });
  try {
    const result = await query(
      "INSERT INTO departments (name) VALUES ($1) RETURNING id, name, created_at",
      [name]
    );
    res.status(201).json({ department: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A department with this name already exists." });
    throw err;
  }
});

router.put("/:id", requireAuth, requirePermission("devices.edit"), async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Department name is required." });
  const result = await query(
    "UPDATE departments SET name = $1 WHERE id = $2 RETURNING id, name, created_at",
    [name, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Department not found." });
  res.json({ department: result.rows[0] });
});

router.get("/:id/usage", requireAuth, requirePermission("devices.delete"), async (req, res) => {
  const [users, devices] = await Promise.all([
    query("SELECT count(*)::int AS n FROM users WHERE department_id = $1", [req.params.id]),
    query(
      "SELECT count(*)::int AS n FROM devices WHERE department_id = $1 OR $1 = ANY(assigned_department_ids)",
      [req.params.id]
    ),
  ]);
  res.json({ userCount: users.rows[0].n, deviceCount: devices.rows[0].n });
});

router.delete("/:id", requireAuth, requirePermission("devices.delete"), async (req, res) => {
  await query("UPDATE users SET department_id = NULL WHERE department_id = $1", [req.params.id]);
  await query("UPDATE devices SET department_id = NULL WHERE department_id = $1", [req.params.id]);
  await query(
    "UPDATE devices SET assigned_department_ids = array_remove(assigned_department_ids, $1)",
    [req.params.id]
  );
  const result = await query("DELETE FROM departments WHERE id = $1 RETURNING id", [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: "Department not found." });
  res.json({ ok: true });
});

export default router;
