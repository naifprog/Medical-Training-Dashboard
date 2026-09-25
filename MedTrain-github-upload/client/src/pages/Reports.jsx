import { useState } from "react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";

function ExportButtons({ can, baseUrl, query }) {
  const { t } = useUI();
  if (!can("reports.export")) return null;
  const qs = new URLSearchParams(query).toString();
  return (
    <div className="flex items-center gap-2">
      <a className="btn btn-outline btn-sm" href={`${baseUrl}?${qs}&format=pdf`}><Icon name="printer" size={14} />{t("report_export_pdf")}</a>
      <a className="btn btn-outline btn-sm" href={`${baseUrl}?${qs}&format=xlsx`}><Icon name="download" size={14} />Excel</a>
      <a className="btn btn-outline btn-sm" href={`${baseUrl}?${qs}&format=csv`}><Icon name="download" size={14} />{t("report_export_csv")}</a>
    </div>
  );
}

function DataTable({ columns, rows, loading, emptyLabel }) {
  const { t } = useUI();
  return (
    <div className="card overflow-hidden">
      <div className="scroll-x">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              {columns.map((c) => <th key={c.key} className="text-start p-3 font-semibold text-xs txt-muted">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={columns.length} className="p-6 text-center text-sm txt-muted">{t("common_loading")}</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={columns.length} className="p-6 text-center text-sm txt-muted">{emptyLabel}</td></tr>}
            {!loading && rows.map((r, i) => (
              <tr key={i} className="border-t b-border">
                {columns.map((c) => <td key={c.key} className="p-3 text-xs">{r[c.key] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Training Compliance intentionally removed from the visible Reports UI
// (per product decision) -- the backend endpoint (/api/reports/compliance)
// is left fully intact and untouched in case anything else still needs it.

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b b-border last:border-0">
      <span className="txt-muted">{label}</span><span className="font-medium">{value}</span>
    </div>
  );
}

function TraineeReportTab({ lang, can }) {
  const { t } = useUI();
  const [traineeId, setTraineeId] = useState("");
  const [search, setSearch] = useState("");
  const { data: usersData } = useFetch(() => api.get("/users"), []);
  // /users is already Trainer-scoped by the backend (a Trainer only ever
  // receives their own trainees) -- this search filters that already-scoped
  // list client-side, so it can never surface a trainee outside scope.
  const trainees = (usersData?.users ?? []).filter((u) => u.roleName === "Trainee");
  const q = search.trim().toLowerCase();
  const filteredTrainees = q
    ? trainees.filter((u) =>
        (u.fullName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.employeeId || "").toLowerCase().includes(q)
      )
    : trainees;
  const { data, loading } = useFetch(() => (traineeId ? api.get(`/reports/trainee/${traineeId}?lang=${lang}`) : Promise.resolve(null)), [traineeId, lang]);

  const columns = [
    { key: "deviceName", label: t("nav_devices") },
    { key: "model", label: t("field_model") },
    { key: "assignedDate", label: t("field_assigned_date") },
    { key: "dueDate", label: t("field_due_date") },
    { key: "status", label: lang === "ar" ? "الحالة" : "Status" },
    { key: "completionDate", label: lang === "ar" ? "تاريخ الإتمام" : "Completion Date" },
    { key: "quizScore", label: lang === "ar" ? "نتيجة الاختبار" : "Quiz Score" },
    { key: "passFail", label: lang === "ar" ? "ناجح/راسب" : "Pass/Fail" },
    { key: "attempts", label: lang === "ar" ? "المحاولات" : "Attempts" },
  ];

  return (
    <div>
      <div className="card p-4 mb-4">
        <input
          type="text"
          className="field-input w-full mb-2"
          placeholder={lang === "ar" ? "ابحث بالاسم أو البريد الإلكتروني أو الرقم الوظيفي…" : "Search by name, email, or employee ID…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-52 overflow-y-auto space-y-1">
          {filteredTrainees.length === 0 ? (
            <div className="text-xs txt-muted text-center p-3">{lang === "ar" ? "لا يوجد متدربون مطابقون" : "No matching trainees"}</div>
          ) : (
            filteredTrainees.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setTraineeId(u.id)}
                className="w-full text-start text-xs p-2 rounded-lg hover:surface2 flex items-center justify-between gap-2"
                style={{ background: traineeId === u.id ? "var(--teal-soft)" : undefined }}
              >
                <span className="truncate">
                  <span className="font-medium">{u.fullName}</span>
                  <span className="txt-muted"> · {u.email}</span>
                </span>
                {traineeId === u.id && <Icon name="check" size={14} />}
              </button>
            ))
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1" />
        {traineeId && <ExportButtons can={can} baseUrl={`/api/reports/trainee/${traineeId}`} query={{ lang }} />}
      </div>
      {traineeId ? (
        <>
          {data?.trainee && (
            <div className="card p-4 mb-4 grid sm:grid-cols-2 gap-x-6">
              <InfoRow label={t("common_name")} value={data.trainee.fullName} />
              <InfoRow label={t("field_employee_id")} value={data.trainee.employeeId} />
              <InfoRow label={lang === "ar" ? "البريد الإلكتروني" : "Email"} value={data.trainee.email} />
              <InfoRow label={t("field_mobile")} value={data.trainee.mobile} />
              <InfoRow label={t("field_job_title")} value={data.trainee.jobTitle} />
              <InfoRow label={t("common_department")} value={data.trainee.departmentName} />
              <InfoRow label={t("field_trainer")} value={data.trainee.trainerName} />
            </div>
          )}
          <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} emptyLabel={t("training_none_active")} />
        </>
      ) : (
        <div className="card p-6 text-sm txt-muted text-center">{lang === "ar" ? "اختر متدربًا لعرض تقريره" : "Select a trainee to view their report"}</div>
      )}
    </div>
  );
}

function DeviceReportTab({ lang, can }) {
  const { t } = useUI();
  const [selectedIds, setSelectedIds] = useState([]);
  const { data: devicesData } = useFetch(() => api.get("/devices"), []);
  const devices = devicesData?.devices ?? [];
  const idsParam = selectedIds.join(",");
  const { data, loading } = useFetch(
    () => (selectedIds.length ? api.get(`/reports/devices?ids=${encodeURIComponent(idsParam)}&lang=${lang}`) : Promise.resolve(null)),
    [idsParam, lang]
  );
  const allSelected = devices.length > 0 && selectedIds.length === devices.length;

  function toggleDevice(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : devices.map((d) => d.id));
  }

  const columns = [
    { key: "deviceName", label: t("nav_devices") },
    { key: "fullName", label: lang === "ar" ? "المتدرب" : "Trainee" },
    { key: "employeeId", label: t("field_employee_id") },
    { key: "trainerName", label: t("field_trainer") },
    { key: "assignedDate", label: t("field_assigned_date") },
    { key: "dueDate", label: t("field_due_date") },
    { key: "status", label: lang === "ar" ? "الحالة" : "Status" },
    { key: "completionDate", label: lang === "ar" ? "تاريخ الإتمام" : "Completion Date" },
    { key: "quizScore", label: lang === "ar" ? "نتيجة الاختبار" : "Quiz Score" },
  ];

  return (
    <div>
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <span className="text-xs font-semibold txt-muted">
            {lang === "ar"
              ? `الأجهزة (${selectedIds.length} من ${devices.length} محدد)`
              : `Devices (${selectedIds.length} of ${devices.length} selected)`}
          </span>
          <button type="button" className="btn btn-outline btn-sm" onClick={toggleSelectAll} disabled={!devices.length}>
            {allSelected ? (lang === "ar" ? "إلغاء تحديد الكل" : "Deselect All") : (lang === "ar" ? "تحديد الكل" : "Select All")}
          </button>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pe-1">
          {devices.length === 0 && <div className="text-xs txt-muted text-center p-3 col-span-full">{t("common_none")}</div>}
          {devices.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-2 text-xs p-2 rounded-lg cursor-pointer hover:surface2"
              style={{ background: selectedIds.includes(d.id) ? "var(--teal-soft)" : undefined }}
            >
              <input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => toggleDevice(d.id)} />
              <span className="truncate">{d.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1" />
        {selectedIds.length > 0 && <ExportButtons can={can} baseUrl="/api/reports/devices" query={{ ids: idsParam, lang }} />}
      </div>
      {selectedIds.length > 0 ? (
        <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} emptyLabel={t("common_none")} />
      ) : (
        <div className="card p-6 text-sm txt-muted text-center">{lang === "ar" ? "اختر جهازًا واحدًا أو أكثر لعرض التقرير" : "Select one or more devices to view the report"}</div>
      )}
    </div>
  );
}

function RosterTab({ lang, can }) {
  const { t } = useUI();
  const { data, loading } = useFetch(() => api.get(`/reports/roster/trainees?lang=${lang}`), [lang]);

  const columns = [
    { key: "full_name", label: t("common_name") },
    { key: "employee_id", label: t("field_employee_id") },
    { key: "email", label: lang === "ar" ? "البريد الإلكتروني" : "Email" },
    { key: "mobile", label: t("field_mobile") },
    { key: "job_title", label: t("field_job_title") },
    { key: "department_name", label: t("common_department") },
    { key: "trainer_name", label: t("field_trainer") },
    { key: "status", label: lang === "ar" ? "الحالة" : "Status" },
  ];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <ExportButtons can={can} baseUrl="/api/reports/roster/trainees" query={{ lang }} />
      </div>
      <DataTable columns={columns} rows={data?.trainees ?? []} loading={loading} emptyLabel={t("common_none")} />
    </div>
  );
}

export default function Reports() {
  const { t, lang } = useUI();
  const { can } = useAuth();
  const [tab, setTab] = useState("trainee");

  const tabs = [
    ["trainee", lang === "ar" ? "تقرير متدرب" : "Trainee Report"],
    ["device", lang === "ar" ? "تقرير جهاز" : "Device Report"],
    ["roster", lang === "ar" ? "قائمة المتدربين" : "Trainee Roster"],
  ];

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <h1 className="font-head text-2xl font-bold mb-6">{t("reports_title")}</h1>
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${tab === k ? "text-white" : "txt-muted"}`} style={tab === k ? { background: "var(--teal)" } : { background: "var(--surface)", border: "1px solid var(--border)" }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "trainee" && <TraineeReportTab lang={lang} can={can} />}
      {tab === "device" && <DeviceReportTab lang={lang} can={can} />}
      {tab === "roster" && <RosterTab lang={lang} can={can} />}
    </div>
  );
}
