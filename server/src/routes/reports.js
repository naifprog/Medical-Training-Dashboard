import express from "express";
import { query } from "../db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { toCsv } from "../utils/csv.js";
import { renderTablePdf } from "../services/pdf.js";

const router = express.Router();

function fmtDate(value, lang) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

router.get("/compliance", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const { departmentId, deviceId, status, lang = "en", format } = req.query;

  const params = [];
  const conditions = [];
  if (departmentId) {
    params.push(departmentId);
    conditions.push(`u.department_id = $${params.length}`);
  }
  if (deviceId) {
    params.push(deviceId);
    conditions.push(`dv.id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `SELECT u.id AS user_id, u.full_name, u.email, d.name AS department_name,
            dv.id AS device_id, dv.name AS device_name,
            p.video_status, p.video_progress_pct, p.video_last_viewed_at,
            p.quiz_passed, p.quiz_best_score, p.certificate_revoked
     FROM users u
     JOIN departments d ON d.id = u.department_id
     CROSS JOIN devices dv
     LEFT JOIN progress p ON p.user_id = u.id AND p.device_id = dv.id
     WHERE u.active = true
       AND (dv.department_id = u.department_id OR u.department_id = ANY(dv.assigned_department_ids) OR dv.assigned_to_all = true
            OR EXISTS (SELECT 1 FROM assignments a WHERE a.user_id = u.id AND a.device_id = dv.id))
       ${conditions.length ? "AND " + conditions.join(" AND ") : ""}
     ORDER BY u.full_name, dv.name`,
    params
  );

  let rows = result.rows.map((r) => {
    const quizStatus = r.quiz_passed ? "passed" : r.quiz_best_score != null ? "failed" : "pending";
    return {
      userId: r.user_id,
      fullName: r.full_name,
      email: r.email,
      departmentName: r.department_name,
      deviceId: r.device_id,
      deviceName: r.device_name,
      videoStatus: r.video_status || "not_started",
      videoProgressPct: r.video_progress_pct != null ? Number(r.video_progress_pct) : 0,
      videoLastViewedAt: r.video_last_viewed_at,
      quizStatus,
      quizBestScore: r.quiz_best_score,
      certificateRevoked: r.certificate_revoked,
    };
  });

  if (status) {
    rows = rows.filter((r) => r.quizStatus === status);
  }

  const columns = [
    { key: "fullName", label: lang === "ar" ? "الاسم" : "Trainee" },
    { key: "departmentName", label: lang === "ar" ? "القسم" : "Department" },
    { key: "deviceName", label: lang === "ar" ? "الجهاز" : "Device" },
    { key: "videoProgressPctLabel", label: lang === "ar" ? "تقدم الفيديو" : "Video progress" },
    { key: "quizStatusLabel", label: lang === "ar" ? "حالة الاختبار" : "Quiz status" },
    { key: "videoLastViewedLabel", label: lang === "ar" ? "آخر مشاهدة" : "Last viewed" },
  ];
  const quizStatusLabel = { passed: lang === "ar" ? "ناجح" : "Passed", failed: lang === "ar" ? "لم يجتز" : "Not passed", pending: lang === "ar" ? "لم يبدأ" : "Pending" };
  const exportRows = rows.map((r) => ({
    ...r,
    videoProgressPctLabel: `${Math.round(r.videoProgressPct)}%`,
    quizStatusLabel: quizStatusLabel[r.quizStatus],
    videoLastViewedLabel: fmtDate(r.videoLastViewedAt, lang),
  }));

  if (format === "csv") {
    if (!req.user.permissions["reports.export"]) return res.status(403).json({ error: "Forbidden" });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="compliance-report.csv"');
    return res.send(toCsv(columns, exportRows));
  }

  res.json({ rows, generatedAt: new Date().toISOString() });
});

router.get("/roster/trainees", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const { lang = "en", format } = req.query;
  const result = await query(
    `SELECT u.full_name, u.email, u.employee_id, d.name AS department_name
     FROM users u LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.active = true
     ORDER BY u.full_name`
  );
  const columns = [
    { key: "full_name", label: lang === "ar" ? "الاسم" : "Name" },
    { key: "email", label: lang === "ar" ? "البريد الإلكتروني" : "Email" },
    { key: "employee_id", label: lang === "ar" ? "الرقم الوظيفي" : "Employee ID" },
    { key: "department_name", label: lang === "ar" ? "القسم" : "Department" },
  ];

  if (format === "csv" || format === "pdf") {
    if (!req.user.permissions["reports.export"]) return res.status(403).json({ error: "Forbidden" });
  }
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="trainees-roster.csv"');
    return res.send(toCsv(columns, result.rows));
  }
  if (format === "pdf") {
    const pdf = await renderTablePdf({
      title: lang === "ar" ? "تقرير المتدربين" : "Trainee Roster",
      lang,
      columns,
      rows: result.rows,
      generatedAt: new Date().toLocaleString(lang === "ar" ? "ar-SA" : "en-US"),
      totalLabel: (lang === "ar" ? "الإجمالي: " : "Total: ") + result.rows.length,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="trainees-roster.pdf"');
    return res.send(pdf);
  }
  res.json({ trainees: result.rows });
});

router.get("/roster/devices", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const { lang = "en", format } = req.query;
  const result = await query(
    `SELECT dv.name, dv.device_type, dv.category, d.name AS department_name
     FROM devices dv LEFT JOIN departments d ON d.id = dv.department_id
     ORDER BY dv.name`
  );
  const columns = [
    { key: "name", label: lang === "ar" ? "اسم الجهاز" : "Device" },
    { key: "device_type", label: lang === "ar" ? "النوع" : "Type" },
    { key: "category", label: lang === "ar" ? "الفئة" : "Category" },
    { key: "department_name", label: lang === "ar" ? "القسم" : "Department" },
  ];

  if (format === "csv" || format === "pdf") {
    if (!req.user.permissions["reports.export"]) return res.status(403).json({ error: "Forbidden" });
  }
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="devices-roster.csv"');
    return res.send(toCsv(columns, result.rows));
  }
  if (format === "pdf") {
    const pdf = await renderTablePdf({
      title: lang === "ar" ? "تقرير الأجهزة" : "Device Roster",
      lang,
      columns,
      rows: result.rows,
      generatedAt: new Date().toLocaleString(lang === "ar" ? "ar-SA" : "en-US"),
      totalLabel: (lang === "ar" ? "الإجمالي: " : "Total: ") + result.rows.length,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="devices-roster.pdf"');
    return res.send(pdf);
  }
  res.json({ devices: result.rows });
});

export default router;
