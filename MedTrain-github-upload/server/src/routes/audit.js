import express from "express";
import { query } from "../db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = express.Router();

// Dedicated permission (audit.view) rather than piggybacking on
// trainees.viewAll/reports.view -- a Trainer never gets organization-wide
// audit access just because they can see all their own trainees.
router.get("/", requireAuth, requirePermission("audit.view"), async (req, res) => {
  const { actorId, action, entityType, from, to } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const params = [];
  const conditions = [];
  if (actorId) { params.push(actorId); conditions.push(`a.actor_id = $${params.length}`); }
  if (action) { params.push(action); conditions.push(`a.action = $${params.length}`); }
  if (entityType) { params.push(entityType); conditions.push(`a.entity_type = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`a.created_at >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`a.created_at <= $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);
  const result = await query(
    `SELECT a.id, a.actor_id, u.full_name AS actor_name, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({
    entries: result.rows.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_name || "—",
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: r.metadata,
      createdAt: r.created_at,
    })),
  });
});

export default router;
