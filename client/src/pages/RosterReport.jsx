import { useState } from "react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";

function RosterCard({ title, columns, rows, exportBase, lang, t, can }) {
  return (
    <div className="card overflow-hidden mb-8">
      <div className="flex items-center gap-3 p-4 border-b b-border">
        <h2 className="font-head font-semibold flex-1">{title}</h2>
        <span className="text-xs txt-muted">{t("report_total")}: {rows.length}</span>
        {can("reports.export") && (
          <>
            <a className="btn btn-outline btn-sm" href={`${exportBase}&format=csv`}><Icon name="download" size={14} />{t("report_export_csv")}</a>
            <a className="btn btn-outline btn-sm" href={`${exportBase}&format=pdf`}><Icon name="printer" size={14} />{t("report_export_pdf")}</a>
          </>
        )}
      </div>
      <div className="scroll-x">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              {columns.map((c) => <th key={c.key} className="text-start p-3 font-semibold text-xs txt-muted">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t b-border">
                {columns.map((c) => <td key={c.key} className="p-3">{r[c.key] || "—"}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={columns.length} className="p-6 text-center text-sm txt-muted">{t("common_none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RosterReport() {
  const { t, lang } = useUI();
  const { can } = useAuth();

  const { data: traineeData } = useFetch(() => api.get(`/reports/roster/trainees?lang=${lang}`), [lang]);
  const { data: deviceData } = useFetch(() => api.get(`/reports/roster/devices?lang=${lang}`), [lang]);

  const traineeColumns = [
    { key: "full_name", label: t("common_name") },
    { key: "email", label: lang === "ar" ? "البريد الإلكتروني" : "Email" },
    { key: "employee_id", label: t("field_employee_id") },
    { key: "department_name", label: t("common_department") },
  ];
  const deviceColumns = [
    { key: "name", label: t("common_name") },
    { key: "device_type", label: t("field_device_type") },
    { key: "category", label: t("field_category") },
    { key: "department_name", label: t("common_department") },
  ];

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <h1 className="font-head text-2xl font-bold mb-6">{t("nav_report")}</h1>
      <RosterCard
        title={t("report_trainees_title")} columns={traineeColumns} rows={traineeData?.trainees ?? []}
        exportBase={`/api/reports/roster/trainees?lang=${lang}`} lang={lang} t={t} can={can}
      />
      <RosterCard
        title={t("report_devices_title")} columns={deviceColumns} rows={deviceData?.devices ?? []}
        exportBase={`/api/reports/roster/devices?lang=${lang}`} lang={lang} t={t} can={can}
      />
    </div>
  );
}
