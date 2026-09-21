import express from "express";
import { query } from "../db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, requirePermission("assignments.view"), async (req, res) => {
  const result = await query(
    "SELECT id, user_id, device_id, assigned_by, assigned_at FROM assignments ORDER BY assigned_at DESC"
  );
  res.json({
    assignments: result.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      deviceId: r.device_id,
      assignedBy: r.assigned_by,
      assignedAt: r.assigned_at,
    })),
  });
});

router.post("/", requireAuth, requirePermission("assignments.create"), async (req, res) => {
  const { userId, deviceId } = req.body || {};
  if (!userId || !deviceId) return res.status(400).json({ error: "userId and deviceId are required." });
  const result = await query(
    `INSERT INTO assignments (user_id, device_id, assigned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, device_id) DO UPDATE SET assigned_by = EXCLUDED.assigned_by
     RETURNING id, user_id, device_id, assigned_by, assigned_at`,
    [userId, deviceId, req.user.id]
  );
  const r = result.rows[0];
  res.status(201).json({
    assignment: { id: r.id, userId: r.user_id, deviceId: r.device_id, assignedBy: r.assigned_by, assignedAt: r.assigned_at },
  });
});

router.delete("/", requireAuth, requirePermission("assignments.cancel"), async (req, res) => {
  const { userId, deviceId } = req.body || {};
  if (!userId || !deviceId) return res.status(400).json({ error: "userId and deviceId are required." });
  await query("DELETE FROM assignments WHERE user_id = $1 AND device_id = $2", [userId, deviceId]);
  res.json({ ok: true });
});

export default router;
