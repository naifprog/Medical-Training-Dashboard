import crypto from "node:crypto";
import { query } from "../db.js";

const INVITE_TTL_HOURS = 72;
const RESET_TTL_HOURS = 1;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates a token of the given type for a user. Only the raw token is ever
 * usable for lookup; only its SHA-256 hash is persisted. The raw token is
 * returned once, to the caller, and never stored or re-exposed afterward.
 */
export async function createAuthToken(userId, type) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const ttlHours = type === "invite" ? INVITE_TTL_HOURS : RESET_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await query(
    "INSERT INTO auth_tokens (user_id, type, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [userId, type, tokenHash, expiresAt]
  );
  return rawToken;
}

/**
 * Verifies a raw token: must exist, match the expected type, be unused,
 * and not be expired. Returns the associated userId, or null.
 */
export async function verifyAuthToken(rawToken, type) {
  if (!rawToken || typeof rawToken !== "string") return null;
  const tokenHash = hashToken(rawToken);
  const result = await query(
    `SELECT id, user_id, expires_at, used_at FROM auth_tokens
     WHERE token_hash = $1 AND type = $2`,
    [tokenHash, type]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return { tokenId: row.id, userId: row.user_id };
}

export async function consumeAuthToken(tokenId) {
  await query("UPDATE auth_tokens SET used_at = now() WHERE id = $1", [tokenId]);
}
