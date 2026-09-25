import express from "express";
import { query } from "../db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { canSeeAllTrainees } from "../services/traineeScope.js";
import { recordAudit } from "../services/audit.js";

const router = express.Router();

const ASSIGNMENT_COLUMNS = "id, user_id, device_id, assigned_by, assigned_at, due_date, status, cancelled_at, cancelled_by";

function serializeAssignment(r) {
  return {
    id: r.id,
    userId: r.user_id,
    deviceId: r.device_id,
    assignedBy: r.assigned_by,
    assignedAt: r.assigned_at,
    dueDate: r.due_date,
    status: r.status,
    cancelledAt: r.cancelled_at,
    cancelledBy: r.cancelled_by,
  };
}

/** Mirrors devices.js's canManage: a management-capable viewer, as opposed to a trainee looking at their own training. */
function canManage(user) {
  return !!(user.permissions["devices.create"] || user.permissions["devices.edit"] || user.permissions["reports.view"]);
}

/** Returns true if `actor` is allowed to manage assignments for `traineeUserId`. */
async function inScope(actor, traineeUserId) {
  if (canSeeAllTrainees(actor)) return true;
  const result = await query("SELECT trainer_id FROM users WHERE id = $1", [traineeUserId]);
  return result.rows.length > 0 && result.rows[0].trainer_id === actor.id;
}

// Returns both active and historical (cancelled) rows -- the caller (e.g. a
// Trainee Profile page) is expected to group by `status` itself so that
// current and historical training stay visually distinct.
router.get("/", requireAuth, async (req, res) => {
  const { userId } = req.query;

  if (userId) {
    // A user can always list their own assignments (same self-access
    // pattern as GET /progress/mine), independent of assignments.view.
    const isSelf = userId === req.user.id;
    if (!isSelf) {
      if (!req.user.permissions["assignments.view"]) return res.status(403).json({ error: "Forbidden" });
      if (!(await inScope(req.user, userId))) {
        return res.status(403).json({ error: "This trainee is not assigned to you." });
      }
    }
    // A trainee viewing their own training must never see an assignment
    // whose device has since been deactivated -- Admin/Trainer keep full
    // history via the non-self branches below (inScope / org-wide), which
    // intentionally do not apply this filter.
    const hideInactiveDevices = isSelf && !canManage(req.user);
    const result = await query(
      hideInactiveDevices
        ? `SELECT a.id, a.user_id, a.device_id, a.assigned_by, a.assigned_at, a.due_date, a.status, a.cancelled_at, a.cancelled_by
           FROM assignments a JOIN devices d ON d.id = a.device_id
           WHERE a.user_id = $1 AND d.active = true
           ORDER BY a.assigned_at DESC`
        : `SELECT ${ASSIGNMENT_COLUMNS} FROM assignments WHERE user_id = $1 ORDER BY assigned_at DESC`,
      [userId]
    );
    return res.json({ assignments: result.rows.map(serializeAssignment) });
  }

  if (!req.user.permissions["assignments.view"]) return res.status(403).json({ error: "Forbidden" });

  if (canSeeAllTrainees(req.user)) {
    const result = await query(`SELECT ${ASSIGNMENT_COLUMNS} FROM assignments ORDER BY assigned_at DESC`);
    return res.json({ assignments: result.rows.map(serializeAssignment) });
  }
  const result = await query(
    `SELECT a.id, a.user_id, a.device_id, a.assigned_by, a.assigned_at, a.due_date, a.status, a.cancelled_at, a.cancelled_by
     FROM assignments a JOIN users u ON u.id = a.user_id
     WHERE u.trainer_id = $1
     ORDER BY a.assigned_at DESC`,
    [req.user.id]
  );
  res.json({ assignments: result.rows.map(serializeAssignment) });
});

router.post("/", requireAuth, requirePermission("assignments.create"), async (req, res) => {
  const { userId, deviceId, dueDate } = req.body || {};
  if (!userId || !deviceId) return res.status(400).json({ error: "userId and deviceId are required." });
  if (!(await inScope(req.user, userId))) {
    return res.status(403).json({ error: "This trainee is not assigned to you." });
  }

  const deviceRow = await query("SELECT active FROM devices WHERE id = $1", [deviceId]);
  if (!deviceRow.rows.length) return res.status(404).json({ error: "Device not found." });
  if (!deviceRow.rows[0].active) {
    return res.status(409).json({ error: "This device is inactive and cannot be assigned." });
  }

  const existingActive = await query(
    "SELECT id FROM assignments WHERE user_id = $1 AND device_id = $2 AND status = 'active'",
    [userId, deviceId]
  );
  if (existingActive.rows.length) {
    return res.status(409).json({ error: "This device is already actively assigned to this trainee." });
  }

  try {
    const result = await query(
      `INSERT INTO assignments (user_id, device_id, assigned_by, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING ${ASSIGNMENT_COLUMNS}`,
      [userId, deviceId, req.user.id, dueDate || null]
    );
    await recordAudit(req.user.id, "training.assigned", "assignment", result.rows[0].id, { userId, deviceId });
    res.status(201).json({ assignment: serializeAssignment(result.rows[0]) });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "This device is already actively assigned to this trainee." });
    }
    throw err;
  }
});

// Changes the due date of an existing assignment (any status -- editing a
// cancelled row's due date is harmless and keeps this endpoint simple).
router.put("/:id", requireAuth, requirePermission("assignments.edit"), async (req, res) => {
  const existing = await query("SELECT user_id FROM assignments WHERE id = $1", [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: "Assignment not found." });
  if (!(await inScope(req.user, existing.rows[0].user_id))) {
    return res.status(403).json({ error: "This trainee is not assigned to you." });
  }
  const { dueDate } = req.body || {};
  const result = await query(
    `UPDATE assignments SET due_date = $1 WHERE id = $2 RETURNING ${ASSIGNMENT_COLUMNS}`,
    [dueDate || null, req.params.id]
  );
  await recordAudit(req.user.id, "training.due_date_changed", "assignment", req.params.id, { dueDate: dueDate || null });
  res.json({ assignment: serializeAssignment(result.rows[0]) });
});

// Cancels (does not delete) the active assignment for this trainee/device
// pair, preserving it -- and all related progress -- as history. The same
// device can later be assigned again as a brand new active row, since the
// Phase 1 unique index only applies to status='active'.
router.delete("/", requireAuth, requirePermission("assignments.cancel"), async (req, res) => {
  const { userId, deviceId } = req.body || {};
  if (!userId || !deviceId) return res.status(400).json({ error: "userId and deviceId are required." });
  if (!(await inScope(req.user, userId))) {
    return res.status(403).json({ error: "This trainee is not assigned to you." });
  }
  const result = await query(
    `UPDATE assignments SET status = 'cancelled', cancelled_at = now(), cancelled_by = $3
     WHERE user_id = $1 AND device_id = $2 AND status = 'active'
     RETURNING ${ASSIGNMENT_COLUMNS}`,
    [userId, deviceId, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "No active assignment found for this device." });
  await recordAudit(req.user.id, "training.cancelled", "assignment", result.rows[0].id, { userId, deviceId });
  res.json({ ok: true, assignment: serializeAssignment(result.rows[0]) });
});

export default router;
