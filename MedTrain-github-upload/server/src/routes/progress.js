import express from "express";
import { query } from "../db.js";
import { requireAuth, requirePermission, requireAnyPermission } from "../middleware/auth.js";
import { serializeProgressRow } from "../utils/serialize.js";
import { canSeeAllTrainees } from "../services/traineeScope.js";

const router = express.Router();

const PROGRESS_SELECT = `
  SELECT id, user_id, device_id, video_status, video_progress_pct, video_view_count,
         video_last_viewed_at, video_completed_at, quiz_attempts, quiz_best_score,
         quiz_last_score, quiz_passed, quiz_passed_at, certificate_revoked
  FROM progress
`;

async function deviceVisibleToUser(user, deviceId) {
  const canManage = user.permissions["devices.create"] || user.permissions["devices.edit"] || user.permissions["reports.view"];
  if (canManage) return true;
  // A trainee can never record video/quiz progress against an inactive
  // device, even by calling the API directly with a previously-known id.
  const result = await query(
    `SELECT 1 FROM devices dv
     WHERE dv.id = $1
       AND dv.active = true
       AND (dv.department_id = $2 OR $2 = ANY(dv.assigned_department_ids) OR dv.assigned_to_all = true
            OR EXISTS (SELECT 1 FROM assignments a WHERE a.device_id = dv.id AND a.user_id = $3))`,
    [deviceId, user.departmentId, user.id]
  );
  return result.rows.length > 0;
}

async function upsertProgress(userId, deviceId, patch) {
  const existing = await query(`${PROGRESS_SELECT} WHERE user_id = $1 AND device_id = $2`, [userId, deviceId]);
  const prev = existing.rows[0] || null;

  const merged = {
    video_status: patch.video_status ?? prev?.video_status ?? "not_started",
    video_progress_pct: patch.video_progress_pct ?? prev?.video_progress_pct ?? 0,
    video_view_count: patch.video_view_count ?? prev?.video_view_count ?? 0,
    video_last_viewed_at: patch.video_last_viewed_at ?? prev?.video_last_viewed_at ?? null,
    video_completed_at: patch.video_completed_at ?? prev?.video_completed_at ?? null,
    quiz_attempts: patch.quiz_attempts ?? prev?.quiz_attempts ?? [],
    quiz_best_score: patch.quiz_best_score ?? prev?.quiz_best_score ?? null,
    quiz_last_score: patch.quiz_last_score ?? prev?.quiz_last_score ?? null,
    quiz_passed: patch.quiz_passed ?? prev?.quiz_passed ?? false,
    quiz_passed_at: patch.quiz_passed_at ?? prev?.quiz_passed_at ?? null,
    certificate_revoked: patch.certificate_revoked ?? prev?.certificate_revoked ?? false,
  };

  const result = await query(
    `INSERT INTO progress (user_id, device_id, video_status, video_progress_pct, video_view_count,
                            video_last_viewed_at, video_completed_at, quiz_attempts, quiz_best_score,
                            quiz_last_score, quiz_passed, quiz_passed_at, certificate_revoked, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
     ON CONFLICT (user_id, device_id) DO UPDATE SET
       video_status = EXCLUDED.video_status,
       video_progress_pct = EXCLUDED.video_progress_pct,
       video_view_count = EXCLUDED.video_view_count,
       video_last_viewed_at = EXCLUDED.video_last_viewed_at,
       video_completed_at = EXCLUDED.video_completed_at,
       quiz_attempts = EXCLUDED.quiz_attempts,
       quiz_best_score = EXCLUDED.quiz_best_score,
       quiz_last_score = EXCLUDED.quiz_last_score,
       quiz_passed = EXCLUDED.quiz_passed,
       quiz_passed_at = EXCLUDED.quiz_passed_at,
       certificate_revoked = EXCLUDED.certificate_revoked,
       updated_at = now()
     RETURNING id, user_id, device_id, video_status, video_progress_pct, video_view_count,
               video_last_viewed_at, video_completed_at, quiz_attempts, quiz_best_score,
               quiz_last_score, quiz_passed, quiz_passed_at, certificate_revoked`,
    [
      userId,
      deviceId,
      merged.video_status,
      merged.video_progress_pct,
      merged.video_view_count,
      merged.video_last_viewed_at,
      merged.video_completed_at,
      JSON.stringify(merged.quiz_attempts),
      merged.quiz_best_score,
      merged.quiz_last_score,
      merged.quiz_passed,
      merged.quiz_passed_at,
      merged.certificate_revoked,
    ]
  );
  return result.rows[0];
}

router.get("/", requireAuth, requireAnyPermission("trainees.view", "reports.view", "quiz.results"), async (req, res) => {
  if (canSeeAllTrainees(req.user)) {
    const result = await query(`${PROGRESS_SELECT} ORDER BY updated_at DESC NULLS LAST`);
    return res.json({ progress: result.rows.map(serializeProgressRow) });
  }
  const result = await query(
    `${PROGRESS_SELECT} WHERE user_id IN (SELECT id FROM users WHERE trainer_id = $1) ORDER BY updated_at DESC NULLS LAST`,
    [req.user.id]
  );
  res.json({ progress: result.rows.map(serializeProgressRow) });
});

router.get("/mine", requireAuth, async (req, res) => {
  // Self-view only: never surface progress tied to a device that's since
  // been deactivated. The underlying row is untouched -- this is a read
  // filter, not a delete -- so reactivating the device restores visibility.
  const result = await query(
    `SELECT p.id, p.user_id, p.device_id, p.video_status, p.video_progress_pct, p.video_view_count,
            p.video_last_viewed_at, p.video_completed_at, p.quiz_attempts, p.quiz_best_score,
            p.quiz_last_score, p.quiz_passed, p.quiz_passed_at, p.certificate_revoked
     FROM progress p
     JOIN devices d ON d.id = p.device_id
     WHERE p.user_id = $1 AND d.active = true`,
    [req.user.id]
  );
  res.json({ progress: result.rows.map(serializeProgressRow) });
});

router.get("/user/:userId", requireAuth, async (req, res) => {
  if (req.params.userId !== req.user.id && !canSeeAllTrainees(req.user)) {
    if (!(req.user.permissions["trainees.view"] || req.user.permissions["reports.view"])) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const target = await query("SELECT trainer_id FROM users WHERE id = $1", [req.params.userId]);
    if (!target.rows.length || target.rows[0].trainer_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  const result = await query(`${PROGRESS_SELECT} WHERE user_id = $1`, [req.params.userId]);
  res.json({ progress: result.rows.map(serializeProgressRow) });
});

router.post("/:deviceId/video", requireAuth, async (req, res) => {
  if (!(await deviceVisibleToUser(req.user, req.params.deviceId))) {
    return res.status(403).json({ error: "This device is not assigned to you." });
  }
  const pct = Math.max(0, Math.min(100, Number(req.body?.progressPct) || 0));
  const ended = !!req.body?.ended;
  const now = new Date();

  const existing = await query(
    `${PROGRESS_SELECT} WHERE user_id = $1 AND device_id = $2`,
    [req.user.id, req.params.deviceId]
  );
  const prevPct = existing.rows[0]?.video_progress_pct ? Number(existing.rows[0].video_progress_pct) : 0;
  const nextPct = Math.max(prevPct, pct, ended ? 100 : 0);
  const status = nextPct >= 90 ? "completed" : nextPct > 0 ? "in_progress" : "not_started";
  const wasCompleted = existing.rows[0]?.video_status === "completed";

  const row = await upsertProgress(req.user.id, req.params.deviceId, {
    video_progress_pct: nextPct,
    video_status: status,
    video_last_viewed_at: now,
    video_completed_at: status === "completed" ? existing.rows[0]?.video_completed_at || now : existing.rows[0]?.video_completed_at || null,
    video_view_count: ended && !wasCompleted ? (existing.rows[0]?.video_view_count || 0) + 1 : existing.rows[0]?.video_view_count,
  });
  res.json({ progress: serializeProgressRow(row) });
});

router.post("/:deviceId/video/mark-watched", requireAuth, async (req, res) => {
  if (!(await deviceVisibleToUser(req.user, req.params.deviceId))) {
    return res.status(403).json({ error: "This device is not assigned to you." });
  }
  const existing = await query(`${PROGRESS_SELECT} WHERE user_id = $1 AND device_id = $2`, [req.user.id, req.params.deviceId]);
  const now = new Date();
  const row = await upsertProgress(req.user.id, req.params.deviceId, {
    video_status: "completed",
    video_progress_pct: 100,
    video_last_viewed_at: now,
    video_completed_at: existing.rows[0]?.video_completed_at || now,
    video_view_count: (existing.rows[0]?.video_view_count || 0) + 1,
  });
  res.json({ progress: serializeProgressRow(row) });
});

router.post("/:deviceId/quiz/submit", requireAuth, async (req, res) => {
  if (!(await deviceVisibleToUser(req.user, req.params.deviceId))) {
    return res.status(403).json({ error: "This device is not assigned to you." });
  }
  const deviceResult = await query("SELECT quiz, passing_score FROM devices WHERE id = $1", [req.params.deviceId]);
  if (!deviceResult.rows.length) return res.status(404).json({ error: "Device not found." });
  const quiz = deviceResult.rows[0].quiz || [];
  const passingScore = deviceResult.rows[0].passing_score ?? 80;
  if (!quiz.length) return res.status(400).json({ error: "This device has no quiz." });

  // The server is the sole source of truth for scoring -- the client never
  // sends a score, only its raw selected answers, and correctIndex is read
  // here from the device's stored quiz, never trusted from the request.
  const answers = req.body?.answers || {};
  let correctCount = 0;
  const breakdown = quiz.map((q, i) => {
    const raw = answers[i];
    const selectedIndex = raw === undefined || raw === null ? null : Number(raw);
    const correct = selectedIndex === q.correctIndex;
    if (correct) correctCount++;
    return {
      questionIndex: i,
      question: q.question,
      options: q.options,
      selectedIndex,
      correctIndex: q.correctIndex,
      correct,
    };
  });
  const score = Math.round((correctCount / quiz.length) * 100);
  const passed = score >= passingScore;
  const now = new Date();

  const existing = await query(`${PROGRESS_SELECT} WHERE user_id = $1 AND device_id = $2`, [req.user.id, req.params.deviceId]);
  const prev = existing.rows[0];
  // Every attempt is appended, never overwritten -- only the oldest entries
  // roll off past 15 kept attempts per (user, device).
  const attempts = [...(prev?.quiz_attempts || []), { score, passed, passingScore, at: now.toISOString(), answers: breakdown }].slice(-15);
  const everPassed = passed || !!prev?.quiz_passed;

  const row = await upsertProgress(req.user.id, req.params.deviceId, {
    quiz_attempts: attempts,
    quiz_last_score: score,
    quiz_best_score: Math.max(score, prev?.quiz_best_score || 0),
    quiz_passed: everPassed,
    quiz_passed_at: everPassed ? prev?.quiz_passed_at || now : prev?.quiz_passed_at || null,
    certificate_revoked: everPassed ? false : prev?.certificate_revoked || false,
  });
  res.json({
    progress: serializeProgressRow(row),
    score,
    passed,
    passingScore,
    correctCount,
    totalQuestions: quiz.length,
    breakdown,
  });
});

router.post("/:deviceId/certificate/revoke", requireAuth, requirePermission("certificates.revoke"), async (req, res) => {
  const row = await upsertProgress(req.body.userId, req.params.deviceId, { certificate_revoked: true });
  res.json({ progress: serializeProgressRow(row) });
});

export default router;
