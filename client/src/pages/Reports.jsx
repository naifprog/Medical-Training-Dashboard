import { useMemo, useState } from "react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";
import { fmtDate } from "../utils/youtube";

export default function Reports() {
  const { t, lang } = useUI();
  const { can } = useAuth();
  const [departmentId, setDepartmentId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [status, setStatus] = useState("");

  const { data: deptData } = useFetch(() => api.get("/departments"), []);
  const { data: deviceData } = useFetch(() => api.get("/devices"), []);
  const query = new URLSearchParams({
    ...(departmentId ? { departmentId } : {}),
    ...(deviceId ? { deviceId } : {}),
    ...(status ? { status } : {}),
    lang,
  }).toString();
  const { data, loading, reload } = useFetch(() => api.get(`/reports/compliance?${query}`), [query]);

  const departments = deptData?.departments ?? [];
  const devices = deviceData?.devices ?? [];
  const rows = data?.rows ?? [];

  const statusLabel = { passed: t("quiz_pass"), failed: t("quiz_fail"), pending: lang === "ar" ? "لم يبدأ" : "Pending" };

  async function revoke(row) {
    if (!confirm(lang === "ar" ? "إلغاء هذه الشهادة؟" : "Revoke this certificate?")) return;
    await api.post(`/progress/${row.deviceId}/certificate/revoke`, { userId: row.userId });
    reload();
  }

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <h1 className="font-head text-2xl font-bold mb-6">{t("reports_title")}</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <select className="field-input w-auto" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">{t("common_all")}</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="field-input w-auto" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">{t("nav_devices")}</option>
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="field-input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("filter_status")}</option>
          <option value="passed">{t("quiz_pass")}</option>
          <option value="failed">{t("quiz_fail")}</option>
          <option value="pending">{lang === "ar" ? "لم يبدأ" : "Pending"}</option>
        </select>
        <div className="flex-1" />
        {can("reports.export") && (
          <a className="btn btn-outline" href={`/api/reports/compliance?${query}&format=csv`}>
            <Icon name="download" size={16} />{t("report_export_csv")}
          </a>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{lang === "ar" ? "المتدرب" : "Trainee"}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("common_department")}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("nav_devices")}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("track_progress")}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("tab_quiz")}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("track_last_viewed")}</th>
                {can("certificates.revoke") && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-6 text-center text-sm txt-muted">{t("common_loading")}</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-sm txt-muted">{t("reports_empty")}</td></tr>}
              {rows.map((r, i) => (
                <tr key={i} className="border-t b-border">
                  <td className="p-3 font-medium">{r.fullName}</td>
                  <td className="p-3 text-xs">{r.departmentName}</td>
                  <td className="p-3 text-xs">{r.deviceName}</td>
                  <td className="p-3 text-xs">{Math.round(r.videoProgressPct)}%</td>
                  <td className="p-3">
                    <span className={`badge ${r.quizStatus === "passed" ? "badge-pass" : r.quizStatus === "failed" ? "badge-fail" : ""}`} style={r.quizStatus === "pending" ? { background: "var(--surface-2)", color: "var(--text-muted)" } : {}}>
                      {statusLabel[r.quizStatus]}{r.certificateRevoked ? ` (${lang === "ar" ? "ملغاة" : "revoked"})` : ""}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{fmtDate(r.videoLastViewedAt, lang)}</td>
                  {can("certificates.revoke") && (
                    <td className="p-3">
                      {r.quizStatus === "passed" && !r.certificateRevoked && (
                        <button className="btn btn-ghost btn-sm" onClick={() => revoke(r)}>{t("cert_revoke")}</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
