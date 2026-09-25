import { query } from "../db.js";

/**
 * Best-effort audit write: never throws, never blocks or fails the
 * mutation it's recording. Only meaningful mutations are logged here
 * (never GET/page-view traffic). Never pass secrets/passwords/tokens in
 * `metadata`.
 */
export async function recordAudit(actorId, action, entityType, entityId, metadata = {}) {
  try {
    await query(
      "INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)",
      [actorId || null, action, entityType, entityId || null, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error("audit log write failed (non-fatal):", err.message);
  }
}
