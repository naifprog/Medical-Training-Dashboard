import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { query } from "../db.js";
import { requireAuth, requirePermission, requireAnyPermission } from "../middleware/auth.js";
import { serializeDeviceRow, stripQuizAnswers } from "../utils/serialize.js";

const router = express.Router();

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) return cb(new Error("Only video files are allowed."));
    cb(null, true);
  },
});

const DEVICE_SELECT = `
  SELECT dv.id, dv.name, dv.department_id, dp.name AS department_name, dv.device_type, dv.category,
         dv.description, dv.video_url, dv.video_asset_path, dv.alarms, dv.quiz,
         dv.assigned_department_ids, dv.assigned_to_all, dv.created_by, dv.created_at
  FROM devices dv
  LEFT JOIN departments dp ON dp.id = dv.department_id
`;

function canManage(user) {
  return !!(user.permissions["devices.create"] || user.permissions["devices.edit"] || user.permissions["reports.view"]);
}

async function visibleDeviceIdsFor(user) {
  if (canManage(user)) return null; // null = no restriction
  const assigned = await query("SELECT device_id FROM assignments WHERE user_id = $1", [user.id]);
  const assignedIds = assigned.rows.map((r) => r.device_id);
  return assignedIds;
}

router.get("/", requireAuth, requirePermission("devices.view"), async (req, res) => {
  let rows;
  if (canManage(req.user)) {
    rows = (await query(`${DEVICE_SELECT} ORDER BY dv.name`)).rows;
  } else {
    const assignedIds = await visibleDeviceIdsFor(req.user);
    const result = await query(
      `${DEVICE_SELECT}
       WHERE dv.department_id = $1
          OR $1 = ANY(dv.assigned_department_ids)
          OR dv.assigned_to_all = true
          OR dv.id = ANY($2::uuid[])
       ORDER BY dv.name`,
      [req.user.departmentId, assignedIds]
    );
    rows = result.rows;
  }
  const canSeeAnswers = req.user.permissions["devices.edit"] || req.user.permissions["quiz.edit"];
  const devices = rows.map(serializeDeviceRow).map((d) => (canSeeAnswers ? d : stripQuizAnswers(d)));
  res.json({ devices });
});

router.get("/:id", requireAuth, requirePermission("devices.view"), async (req, res) => {
  const result = await query(`${DEVICE_SELECT} WHERE dv.id = $1`, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: "Device not found." });
  const canSeeAnswers = req.user.permissions["devices.edit"] || req.user.permissions["quiz.edit"];
  const device = serializeDeviceRow(result.rows[0]);
  res.json({ device: canSeeAnswers ? device : stripQuizAnswers(device) });
});

router.post("/", requireAuth, requirePermission("devices.create"), async (req, res) => {
  const { name, departmentId, deviceType, category, description, videoUrl, alarms, quiz } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Device name is required." });
  const result = await query(
    `INSERT INTO devices (name, department_id, device_type, category, description, video_url, alarms, quiz, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      name.trim(),
      departmentId || null,
      deviceType?.trim() || null,
      category?.trim() || null,
      description || null,
      videoUrl?.trim() || null,
      JSON.stringify(sanitizeAlarms(alarms)),
      JSON.stringify(sanitizeQuiz(quiz)),
      req.user.id,
    ]
  );
  const created = await query(`${DEVICE_SELECT} WHERE dv.id = $1`, [result.rows[0].id]);
  res.status(201).json({ device: serializeDeviceRow(created.rows[0]) });
});

router.put("/:id", requireAuth, requirePermission("devices.edit"), async (req, res) => {
  const existing = await query("SELECT id FROM devices WHERE id = $1", [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: "Device not found." });

  const { name, departmentId, deviceType, category, description, videoUrl, alarms, quiz, assignedDepartmentIds, assignedToAll } =
    req.body || {};
  const fields = [];
  const params = [];
  function set(col, val) {
    params.push(val);
    fields.push(`${col} = $${params.length}`);
  }
  if (name !== undefined) set("name", name.trim());
  if (departmentId !== undefined) set("department_id", departmentId || null);
  if (deviceType !== undefined) set("device_type", deviceType?.trim() || null);
  if (category !== undefined) set("category", category?.trim() || null);
  if (description !== undefined) set("description", description || null);
  if (videoUrl !== undefined) set("video_url", videoUrl?.trim() || null);
  if (alarms !== undefined) set("alarms", JSON.stringify(sanitizeAlarms(alarms)));
  if (quiz !== undefined) set("quiz", JSON.stringify(sanitizeQuiz(quiz)));
  if (assignedDepartmentIds !== undefined) set("assigned_department_ids", assignedDepartmentIds);
  if (assignedToAll !== undefined) set("assigned_to_all", !!assignedToAll);
  set("updated_at", new Date());

  params.push(req.params.id);
  await query(`UPDATE devices SET ${fields.join(", ")} WHERE id = $${params.length}`, params);
  const updated = await query(`${DEVICE_SELECT} WHERE dv.id = $1`, [req.params.id]);
  res.json({ device: serializeDeviceRow(updated.rows[0]) });
});

router.delete("/:id", requireAuth, requirePermission("devices.delete"), async (req, res) => {
  const result = await query("DELETE FROM devices WHERE id = $1 RETURNING video_asset_path", [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: "Device not found." });
  const assetPath = result.rows[0].video_asset_path;
  if (assetPath) {
    fs.unlink(path.join(uploadDir, path.basename(assetPath)), () => {});
  }
  res.json({ ok: true });
});

router.post(
  "/:id/video",
  requireAuth,
  requireAnyPermission("devices.create", "devices.edit"),
  upload.single("video"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No video file uploaded." });
    const assetPath = `/uploads/${req.file.filename}`;
    const result = await query(
      "UPDATE devices SET video_asset_path = $1, updated_at = now() WHERE id = $2 RETURNING id",
      [assetPath, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Device not found." });
    res.json({ videoAssetPath: assetPath });
  }
);

// --- Assignment sub-routes (per-device, in addition to /api/assignments) ---

router.get("/:id/assignments", requireAuth, requirePermission("devices.assign"), async (req, res) => {
  const result = await query(
    `SELECT a.user_id, u.full_name, u.email, a.assigned_at
     FROM assignments a JOIN users u ON u.id = a.user_id
     WHERE a.device_id = $1 ORDER BY u.full_name`,
    [req.params.id]
  );
  res.json({ assignments: result.rows.map((r) => ({ userId: r.user_id, fullName: r.full_name, email: r.email, assignedAt: r.assigned_at })) });
});

function sanitizeAlarms(alarms) {
  if (!Array.isArray(alarms)) return [];
  return alarms
    .filter((a) => a && a.title?.trim())
    .map((a) => ({ title: a.title.trim(), cause: a.cause || "", fix: a.fix || "" }));
}

function sanitizeQuiz(quiz) {
  if (!Array.isArray(quiz)) return [];
  return quiz
    .filter((q) => q && q.question?.trim() && Array.isArray(q.options))
    .map((q) => ({
      question: q.question.trim(),
      options: q.options.map((o) => String(o || "")),
      correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
    }));
}

export default router;
