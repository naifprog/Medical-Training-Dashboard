import express from "express";
import { query } from "../db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { toCsv } from "../utils/csv.js";
import { renderTablePdf } from "../services/pdf.js";
import { renderTableXlsx } from "../services/excel.js";
import { canSeeAllTrainees } from "../services/traineeScope.js";
import { getCompanyHeaderForPdf } from "../services/companySettings.js";

const router = express.Router();

function fmtDate(value, lang) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

const STATUS_LABEL = {
  en: { completed: "Completed", overdue: "Overdue", in_progress: "In Progress", not_started: "Not Started", cancelled: "Cancelled" },
  ar: { completed: "مكتمل", overdue: "متأخر", in_progress: "قيد التنفيذ", not_started: "لم يبدأ", cancelled: "مُلغى" },
};

/** Mirrors client/src/utils/training.js so status is identical everywhere. */
function computeStatus(assignment, progress) {
  if (assignment.status === "cancelled") return "cancelled";
  const completed = progress?.video_status === "completed" && !!progress?.quiz_passed;
  if (completed) return "completed";
  if (assignment.due_date && String(assignment.due_date) < new Date().toISOString().slice(0, 10)) return "overdue";
  const started = progress && (progress.video_status === "in_progress" || progress.video_status === "completed" || (progress.quiz_attempts || []).length > 0);
  return started ? "in_progress" : "not_started";
}

/** Trainer-scope guard shared by every report below. Returns the effective trainerId filter (or null for unscoped). */
function effectiveTrainerFilter(req) {
  if (canSeeAllTrainees(req.user)) return req.query.trainerId || null;
  return req.user.id; // a scoped caller can only ever see their own trainees, regardless of what they pass
}

async function sendExport({ req, res, format, filename, title, columns, rows, lang }) {
  if ((format === "csv" || format === "pdf" || format === "xlsx") && !req.user.permissions["reports.export"]) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(toCsv(columns, rows));
  }
  if (format === "pdf") {
    // A PDF-generation failure (e.g. the Playwright browser missing) must
    // never take down the whole server -- return a normal error response.
    try {
      const companyHeader = await getCompanyHeaderForPdf();
      const pdf = await renderTablePdf({
        title, lang, columns, rows, companyHeader,
        generatedAt: new Date().toLocaleString(lang === "ar" ? "ar-SA" : "en-US"),
        totalLabel: (lang === "ar" ? "الإجمالي: " : "Total: ") + rows.length,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
      return res.send(pdf);
    } catch (err) {
      console.error("PDF export failed:", err);
      return res.status(503).json({ error: "PDF generation is currently unavailable." });
    }
  }
  if (format === "xlsx") {
    try {
      const xlsx = await renderTableXlsx({ title, columns, rows });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
      return res.send(Buffer.from(xlsx));
    } catch (err) {
      console.error("Excel export failed:", err);
      return res.status(503).json({ error: "Excel generation is currently unavailable." });
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// 1. Training Compliance -- one row per trainee, counts across all their
//    active training assignments.
// ---------------------------------------------------------------------
router.get("/compliance", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const { departmentId, lang = "en", format } = req.query;
  const trainerFilter = effectiveTrainerFilter(req);

  const params = [];
  const conditions = ["r.name = 'Trainee'", "u.active = true"];
  if (departmentId) { params.push(departmentId); conditions.push(`u.department_id = $${params.length}`); }
  if (trainerFilter) { params.push(trainerFilter); conditions.push(`u.trainer_id = $${params.length}`); }

  const traineeResult = await query(
    `SELECT u.id, u.full_name, u.employee_id, d.name AS department_name, tr.full_name AS trainer_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN users tr ON tr.id = u.trainer_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY u.full_name`,
    params
  );

  const rows = [];
  for (const t of traineeResult.rows) {
    const assignResult = await query(
      `SELECT a.status, a.due_date, p.video_status, p.quiz_passed, p.quiz_attempts
       FROM assignments a
       LEFT JOIN progress p ON p.user_id = a.user_id AND p.device_id = a.device_id
       WHERE a.user_id = $1 AND a.status = 'active'`,
      [t.id]
    );
    let completed = 0, overdue = 0, notStarted = 0;
    for (const a of assignResult.rows) {
      // `a` already carries both the assignment columns (status, due_date)
      // and the LEFT JOINed progress columns on the same row.
      const status = computeStatus(a, a);
      if (status === "completed") completed++;
      else if (status === "overdue") overdue++;
      else if (status === "not_started") notStarted++;
    }
    const assigned = assignResult.rows.length;
    const inProgress = Math.max(assigned - completed - overdue - notStarted, 0);
    rows.push({
      fullName: t.full_name,
      employeeId: t.employee_id || "—",
      departmentName: t.department_name || "—",
      trainerName: t.trainer_name || "—",
      assigned,
      completed,
      inProgress,
      notStarted,
      overdue,
      completionPct: assigned ? Math.round((completed / assigned) * 100) : 0,
    });
  }

  const columns = [
    { key: "fullName", label: lang === "ar" ? "المتدرب" : "Trainee" },
    { key: "employeeId", label: lang === "ar" ? "الرقم الوظيفي" : "Employee ID" },
    { key: "departmentName", label: lang === "ar" ? "القسم" : "Department" },
    { key: "trainerName", label: lang === "ar" ? "المدرّب" : "Trainer" },
    { key: "assigned", label: lang === "ar" ? "المخصص" : "Assigned" },
    { key: "completed", label: lang === "ar" ? "مكتمل" : "Completed" },
    { key: "inProgress", label: lang === "ar" ? "قيد التنفيذ" : "In Progress" },
    { key: "notStarted", label: lang === "ar" ? "لم يبدأ" : "Not Started" },
    { key: "overdue", label: lang === "ar" ? "متأخر" : "Overdue" },
    { key: "completionPct", label: lang === "ar" ? "نسبة الإكمال %" : "Completion %" },
  ];

  const exported = await sendExport({ req, res, format, filename: "training-compliance", title: lang === "ar" ? "تقرير الامتثال التدريبي" : "Training Compliance Report", columns, rows, lang });
  if (exported !== null) return;
  res.json({ rows, generatedAt: new Date().toISOString() });
});

// ---------------------------------------------------------------------
// 2. Trainee Training Report -- detail for one trainee.
// ---------------------------------------------------------------------
router.get("/trainee/:id", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const { lang = "en", format } = req.query;
  const traineeResult = await query(
    `SELECT u.id, u.full_name, u.employee_id, u.email, u.mobile, u.job_title,
            d.name AS department_name, tr.full_name AS trainer_name, u.trainer_id
     FROM users u LEFT JOIN departments d ON d.id = u.department_id LEFT JOIN users tr ON tr.id = u.trainer_id
     WHERE u.id = $1`,
    [req.params.id]
  );
  if (!traineeResult.rows.length) return res.status(404).json({ error: "Trainee not found." });
  const trainee = traineeResult.rows[0];

  if (!canSeeAllTrainees(req.user) && trainee.trainer_id !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const assignResult = await query(
    `SELECT dv.name AS device_name, dv.model, a.assigned_at, a.due_date, a.status,
            p.video_status, p.video_completed_at, p.quiz_best_score, p.quiz_passed, p.quiz_attempts
     FROM assignments a
     JOIN devices dv ON dv.id = a.device_id
     LEFT JOIN progress p ON p.user_id = a.user_id AND p.device_id = a.device_id
     WHERE a.user_id = $1
     ORDER BY a.assigned_at DESC`,
    [req.params.id]
  );

  const rows = assignResult.rows.map((r) => {
    const status = computeStatus(r, r);
    return {
      deviceName: r.device_name,
      model: r.model || "—",
      assignedDate: fmtDate(r.assigned_at, lang),
      dueDate: r.due_date || "—",
      status: STATUS_LABEL[lang]?.[status] || status,
      completionDate: r.video_completed_at ? fmtDate(r.video_completed_at, lang) : "—",
      quizScore: r.quiz_best_score != null ? `${r.quiz_best_score}%` : "—",
      passFail: r.quiz_passed ? (lang === "ar" ? "ناجح" : "Pass") : (r.quiz_best_score != null ? (lang === "ar" ? "راسب" : "Fail") : "—"),
      attempts: (r.quiz_attempts || []).length,
    };
  });

  const columns = [
    { key: "deviceName", label: lang === "ar" ? "الجهاز" : "Device" },
    { key: "model", label: lang === "ar" ? "الطراز" : "Model" },
    { key: "assignedDate", label: lang === "ar" ? "تاريخ التعيين" : "Assigned Date" },
    { key: "dueDate", label: lang === "ar" ? "تاريخ الاستحقاق" : "Due Date" },
    { key: "status", label: lang === "ar" ? "الحالة" : "Status" },
    { key: "completionDate", label: lang === "ar" ? "تاريخ الإتمام" : "Completion Date" },
    { key: "quizScore", label: lang === "ar" ? "نتيجة الاختبار" : "Quiz Score" },
    { key: "passFail", label: lang === "ar" ? "ناجح/راسب" : "Pass/Fail" },
    { key: "attempts", label: lang === "ar" ? "المحاولات" : "Attempts" },
  ];

  const header = {
    fullName: trainee.full_name, employeeId: trainee.employee_id, email: trainee.email,
    mobile: trainee.mobile, jobTitle: trainee.job_title, departmentName: trainee.department_name, trainerName: trainee.trainer_name,
  };

  const exported = await sendExport({ req, res, format, filename: `trainee-report-${trainee.full_name}`, title: `${lang === "ar" ? "تقرير المتدرب" : "Trainee Report"} — ${trainee.full_name}`, columns, rows, lang });
  if (exported !== null) return;
  res.json({ trainee: header, rows });
});

// ---------------------------------------------------------------------
// 3. Device Training Report -- who is assigned a given device.
// ---------------------------------------------------------------------
router.get("/device/:id", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const { lang = "en", format } = req.query;
  const deviceResult = await query("SELECT dv.name, dv.model, dp.name AS department_name FROM devices dv LEFT JOIN departments dp ON dp.id = dv.department_id WHERE dv.id = $1", [req.params.id]);
  if (!deviceResult.rows.length) return res.status(404).json({ error: "Device not found." });
  const device = deviceResult.rows[0];
  const trainerFilter = effectiveTrainerFilter(req);

  const params = [req.params.id];
  const conditions = ["a.device_id = $1"];
  if (trainerFilter) { params.push(trainerFilter); conditions.push(`u.trainer_id = $${params.length}`); }

  const result = await query(
    `SELECT u.full_name, u.employee_id, tr.full_name AS trainer_name, a.assigned_at, a.due_date, a.status,
            p.video_status, p.video_completed_at, p.quiz_best_score, p.quiz_passed
     FROM assignments a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN users tr ON tr.id = u.trainer_id
     LEFT JOIN progress p ON p.user_id = a.user_id AND p.device_id = a.device_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY u.full_name`,
    params
  );

  const rows = result.rows.map((r) => {
    const status = computeStatus(r, r);
    return {
      fullName: r.full_name,
      employeeId: r.employee_id || "—",
      trainerName: r.trainer_name || "—",
      assignedDate: fmtDate(r.assigned_at, lang),
      dueDate: r.due_date || "—",
      status: STATUS_LABEL[lang]?.[status] || status,
      completionDate: r.video_completed_at ? fmtDate(r.video_completed_at, lang) : "—",
      quizScore: r.quiz_best_score != null ? `${r.quiz_best_score}%` : "—",
    };
  });

  const columns = [
    { key: "fullName", label: lang === "ar" ? "المتدرب" : "Trainee" },
    { key: "employeeId", label: lang === "ar" ? "الرقم الوظيفي" : "Employee ID" },
    { key: "trainerName", label: lang === "ar" ? "المدرّب" : "Trainer" },
    { key: "assignedDate", label: lang === "ar" ? "تاريخ التعيين" : "Assigned Date" },
    { key: "dueDate", label: lang === "ar" ? "تاريخ الاستحقاق" : "Due Date" },
    { key: "status", label: lang === "ar" ? "الحالة" : "Status" },
    { key: "completionDate", label: lang === "ar" ? "تاريخ الإتمام" : "Completion Date" },
    { key: "quizScore", label: lang === "ar" ? "نتيجة الاختبار" : "Quiz Score" },
  ];

  const header = { name: device.name, model: device.model, departmentName: device.department_name };
  const exported = await sendExport({ req, res, format, filename: `device-report-${device.name}`, title: `${lang === "ar" ? "تقرير الجهاز" : "Device Report"} — ${device.name}`, columns, rows, lang });
  if (exported !== null) return;
  res.json({ device: header, rows });
});

// ---------------------------------------------------------------------
// 3b. Device Training Report (multi-device) -- backs the Device Report
//    tab's "Select All" UX. `ids` is a comma-separated list of device ids;
//    omitting it reports on every device this viewer can see. Rows are the
//    same shape as the single-device report above, plus a `deviceName`
//    column so multiple devices can share one combined table/export.
// ---------------------------------------------------------------------
router.get("/devices", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const { lang = "en", format, ids } = req.query;
  const trainerFilter = effectiveTrainerFilter(req);

  const deviceIdList = ids ? String(ids).split(",").map((s) => s.trim()).filter(Boolean) : null;
  const deviceParams = [];
  let deviceWhere = "";
  if (deviceIdList && deviceIdList.length) {
    deviceParams.push(deviceIdList);
    deviceWhere = `WHERE dv.id = ANY($${deviceParams.length}::uuid[])`;
  }
  const devicesResult = await query(
    `SELECT dv.id, dv.name, dv.model, dp.name AS department_name
     FROM devices dv LEFT JOIN departments dp ON dp.id = dv.department_id
     ${deviceWhere} ORDER BY dv.name`,
    deviceParams
  );
  if (!devicesResult.rows.length) return res.status(404).json({ error: "No devices found." });

  const allRows = [];
  for (const device of devicesResult.rows) {
    const params = [device.id];
    const conditions = ["a.device_id = $1"];
    if (trainerFilter) { params.push(trainerFilter); conditions.push(`u.trainer_id = $${params.length}`); }
    const result = await query(
      `SELECT u.full_name, u.employee_id, tr.full_name AS trainer_name, a.assigned_at, a.due_date, a.status,
              p.video_status, p.video_completed_at, p.quiz_best_score, p.quiz_passed
       FROM assignments a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN users tr ON tr.id = u.trainer_id
       LEFT JOIN progress p ON p.user_id = a.user_id AND p.device_id = a.device_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY u.full_name`,
      params
    );
    for (const r of result.rows) {
      const status = computeStatus(r, r);
      allRows.push({
        deviceName: device.name,
        fullName: r.full_name,
        employeeId: r.employee_id || "—",
        trainerName: r.trainer_name || "—",
        assignedDate: fmtDate(r.assigned_at, lang),
        dueDate: r.due_date || "—",
        status: STATUS_LABEL[lang]?.[status] || status,
        completionDate: r.video_completed_at ? fmtDate(r.video_completed_at, lang) : "—",
        quizScore: r.quiz_best_score != null ? `${r.quiz_best_score}%` : "—",
      });
    }
  }

  const columns = [
    { key: "deviceName", label: lang === "ar" ? "الجهاز" : "Device" },
    { key: "fullName", label: lang === "ar" ? "المتدرب" : "Trainee" },
    { key: "employeeId", label: lang === "ar" ? "الرقم الوظيفي" : "Employee ID" },
    { key: "trainerName", label: lang === "ar" ? "المدرّب" : "Trainer" },
    { key: "assignedDate", label: lang === "ar" ? "تاريخ التعيين" : "Assigned Date" },
    { key: "dueDate", label: lang === "ar" ? "تاريخ الاستحقاق" : "Due Date" },
    { key: "status", label: lang === "ar" ? "الحالة" : "Status" },
    { key: "completionDate", label: lang === "ar" ? "تاريخ الإتمام" : "Completion Date" },
    { key: "quizScore", label: lang === "ar" ? "نتيجة الاختبار" : "Quiz Score" },
  ];

  const devices = devicesResult.rows.map((d) => ({ id: d.id, name: d.name, model: d.model, departmentName: d.department_name }));
  const titleSuffix = devices.length === 1 ? ` — ${devices[0].name}` : ` (${devices.length} ${lang === "ar" ? "أجهزة" : "devices"})`;
  const exported = await sendExport({
    req, res, format, filename: "device-report",
    title: `${lang === "ar" ? "تقرير الجهاز" : "Device Report"}${titleSuffix}`,
    columns, rows: allRows, lang,
  });
  if (exported !== null) return;
  res.json({ devices, rows: allRows });
});

// ---------------------------------------------------------------------
// 4. Trainee Roster -- directory listing, now scoped + enriched.
// ---------------------------------------------------------------------
router.get("/roster/trainees", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const { lang = "en", format } = req.query;
  const trainerFilter = effectiveTrainerFilter(req);
  const params = [];
  const conditions = ["r.name = 'Trainee'"];
  if (trainerFilter) { params.push(trainerFilter); conditions.push(`u.trainer_id = $${params.length}`); }

  const result = await query(
    `SELECT u.full_name, u.employee_id, u.email, u.mobile, u.job_title, d.name AS department_name,
            tr.full_name AS trainer_name, u.active
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN users tr ON tr.id = u.trainer_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY u.full_name`,
    params
  );

  const rows = result.rows.map((r) => ({
    full_name: r.full_name,
    employee_id: r.employee_id || "—",
    email: r.email || "—",
    mobile: r.mobile || "—",
    job_title: r.job_title || "—",
    department_name: r.department_name || "—",
    trainer_name: r.trainer_name || "—",
    status: r.active ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "موقوف" : "Inactive"),
  }));

  const columns = [
    { key: "full_name", label: lang === "ar" ? "الاسم" : "Full Name" },
    { key: "employee_id", label: lang === "ar" ? "الرقم الوظيفي" : "Employee ID" },
    { key: "email", label: lang === "ar" ? "البريد الإلكتروني" : "Email" },
    { key: "mobile", label: lang === "ar" ? "الجوال" : "Mobile" },
    { key: "job_title", label: lang === "ar" ? "المسمى الوظيفي" : "Job Title" },
    { key: "department_name", label: lang === "ar" ? "القسم" : "Department" },
    { key: "trainer_name", label: lang === "ar" ? "المدرّب" : "Trainer" },
    { key: "status", label: lang === "ar" ? "الحالة" : "Status" },
  ];

  const exported = await sendExport({ req, res, format, filename: "trainee-roster", title: lang === "ar" ? "قائمة المتدربين" : "Trainee Roster", columns, rows, lang });
  if (exported !== null) return;
  res.json({ trainees: rows });
});

// ---------------------------------------------------------------------
// 5. Device Roster -- organization-wide equipment catalog (not trainee
//    data, so intentionally not Trainer-scoped, per the approved plan).
// ---------------------------------------------------------------------
router.get("/roster/devices", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const { lang = "en", format } = req.query;
  const result = await query(
    `SELECT dv.name, dv.model, dv.device_type, dv.category, d.name AS department_name, dv.active
     FROM devices dv LEFT JOIN departments d ON d.id = dv.department_id
     ORDER BY dv.name`
  );
  const rows = result.rows.map((r) => ({ ...r, active: r.active ? (lang === "ar" ? "نشط" : "Active") : (lang === "ar" ? "غير نشط" : "Inactive") }));
  const columns = [
    { key: "name", label: lang === "ar" ? "اسم الجهاز" : "Device" },
    { key: "model", label: lang === "ar" ? "الطراز" : "Model" },
    { key: "device_type", label: lang === "ar" ? "النوع" : "Type" },
    { key: "category", label: lang === "ar" ? "الفئة" : "Category" },
    { key: "department_name", label: lang === "ar" ? "القسم" : "Department" },
    { key: "active", label: lang === "ar" ? "الحالة" : "Status" },
  ];

  const exported = await sendExport({ req, res, format, filename: "device-roster", title: lang === "ar" ? "قائمة الأجهزة" : "Device Roster", columns, rows, lang });
  if (exported !== null) return;
  res.json({ devices: rows });
});

export default router;
