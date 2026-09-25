import { useEffect, useState } from "react";
import Icon from "../Icon";
import { useUI } from "../../context/UIContext";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { api, ApiError } from "../../api/client";
import { PERMISSION_GROUPS, groupLabel, permLabel } from "../../i18n/strings";
import { fmtDate } from "../../utils/youtube";

function TrainingProgressSection({ userId }) {
  const { t } = useUI();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ devices }, { progress }] = await Promise.all([
        api.get("/devices"),
        api.get(`/progress/user/${userId}`),
      ]);
      setRows(devices.map((d) => {
        const pr = progress.find((p) => p.deviceId === d.id);
        const videoDone = pr?.videoStatus === "completed";
        const quizDone = !!pr?.quizPassed;
        return { device: d, videoDone, quizDone, done: videoDone && quizDone };
      }));
    })();
  }, [userId]);

  if (rows === null) return null;
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="field-label mb-0">{t("training_progress")}</div>
        <span className="text-[11px] txt-muted">{doneCount}/{rows.length} {t("training_completed_count")}</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs txt-muted">{t("common_none")}</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.device.id} className="surface2 rounded-lg p-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">{r.device.name}</span>
              {r.done ? (
                <span className="badge badge-pass"><Icon name="check" size={11} />{t("training_all_done")}</span>
              ) : (
                <span className="flex flex-wrap gap-1 justify-end">
                  {!r.videoDone && <span className="badge badge-fail">{t("training_video_remaining")}</span>}
                  {!r.quizDone && <span className="badge badge-fail">{t("training_quiz_remaining")}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserDetailModal({ userSummary, roles, departments, onClose, onUpdated }) {
  const { t, lang } = useUI();
  const { can } = useAuth();
  const [p, setP] = useState(userSummary);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(p.fullName || "");
  const [email, setEmail] = useState(p.email || "");
  const [departmentId, setDepartmentId] = useState(p.departmentId || "");
  const [roleId, setRoleId] = useState(p.roleId);
  const [employeeId, setEmployeeId] = useState(p.employeeId || "");
  const [mobile, setMobile] = useState(p.mobile || "");
  const [jobTitle, setJobTitle] = useState(p.jobTitle || "");
  const [active, setActive] = useState(p.active !== false);
  const [trainerId, setTrainerId] = useState(p.trainerId || "");
  const [overrides, setOverrides] = useState(p.permissionOverrides || {});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState(null);

  const role = roles.find((r) => r.id === p.roleId);
  const selectedRoleIsTrainee = roles.find((r) => r.id === roleId)?.name === "Trainee";

  // Trainer options for the Assigned Trainer selector -- reuses the same
  // /api/users endpoint and roleName filter already used elsewhere (e.g.
  // Trainee Profile); no second trainer-trainee mechanism is introduced.
  const { data: allUsersData } = useFetch(() => (can("users.edit") ? api.get("/users") : Promise.resolve(null)), []);
  const trainerOptions = (allUsersData?.users || []).filter((u) => u.roleName === "Trainer" && u.active !== false);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const { user: updated } = await api.put(`/users/${p.id}`, {
        fullName: fullName.trim(), email: email.trim(), departmentId, roleId, employeeId, mobile, jobTitle,
        permissionOverrides: overrides,
        // Only meaningful when the (possibly just-changed) role is Trainee;
        // the backend force-clears this for any other role regardless.
        trainerId: selectedRoleIsTrainee ? (trainerId || null) : null,
      });
      let finalUser = updated;
      // Active/Inactive reuses the existing dedicated activate/deactivate
      // action (which is what invalidates sessions) instead of a second
      // status mechanism on the generic edit endpoint.
      if (active !== (updated.active !== false)) {
        await api.post(`/users/${p.id}/${active ? "activate" : "deactivate"}`);
        finalUser = { ...updated, active };
      }
      setP(finalUser);
      onUpdated(finalUser);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    await api.post(`/users/${p.id}/${p.active === false ? "activate" : "deactivate"}`);
    const updated = { ...p, active: p.active === false };
    setP(updated);
    onUpdated(updated);
  }

  async function resetPassword() {
    if (!confirm(lang === "ar" ? "إعادة تعيين كلمة مرور هذا المستخدم؟" : "Reset this user's password?")) return;
    const { tempPassword: pw } = await api.post(`/users/${p.id}/reset-password`);
    setTempPassword(pw);
  }

  const effectiveRole = roles.find((r) => r.id === roleId) || role;
  const grantedPerms = PERMISSION_GROUPS.flatMap((g) => g.perms
    .filter((s) => !!(effectiveRole?.permissions || {})[`${g.key}.${s}`])
    .map((s) => `${groupLabel(g, lang)} · ${permLabel(s, lang)}`));

  const Row = ({ label, value }) => (
    <div className="flex items-center justify-between py-2.5 border-b b-border last:border-0 gap-3">
      <span className="text-xs txt-muted">{label}</span>
      <span className="text-sm font-medium text-end">{value}</span>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card w-full max-w-md p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b b-border">
          <div className="w-10 h-10 rounded-full surface2 flex items-center justify-center text-sm font-bold">{(p.fullName || "?").slice(0, 1)}</div>
          <div className="flex-1">
            <h3 className="font-head font-bold text-sm">{p.fullName}</h3>
            <div className="text-[11px] txt-muted">{p.email || "—"}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        {tempPassword ? (
          <div className="p-5 text-center">
            <h4 className="font-head font-bold mb-2">{t("users_temp_password_title")}</h4>
            <p className="text-sm txt-muted mb-4">{t("users_temp_password_body")}</p>
            <div className="led text-xl tracking-[.1em] rounded-xl py-4 mb-4 break-all" style={{ background: "var(--surface-2)", color: "var(--teal-dark)" }}>{tempPassword}</div>
            <button className="btn btn-primary w-full justify-center" onClick={() => setTempPassword(null)}>{t("common_close")}</button>
          </div>
        ) : (
          <div className="p-5 max-h-[70vh] overflow-y-auto">
            {!editing ? (
              <div>
                <Row label={t("common_name")} value={p.fullName} />
                <Row label={lang === "ar" ? "البريد الإلكتروني" : "Email"} value={p.email || "—"} />
                <Row label={t("field_employee_id")} value={p.employeeId || "—"} />
                <Row label={t("field_job_title")} value={p.jobTitle || "—"} />
                <Row label={t("field_mobile")} value={p.mobile || "—"} />
                <Row label={t("common_department")} value={p.departmentName || "—"} />
                <Row label={t("users_role")} value={role?.name || "—"} />
                {role?.name === "Trainee" && <Row label={t("field_trainer")} value={p.trainerName || t("trainer_none")} />}
                <Row label={t("users_active")} value={p.active === false ? t("users_deactivated") : t("users_active")} />
                <Row label={t("field_last_active")} value={p.lastLoginAt ? fmtDate(p.lastLoginAt, lang) : "—"} />
                <Row label={t("field_created_by")} value={p.createdByName || "—"} />
                <Row label={t("field_created_date")} value={fmtDate(p.createdAt, lang)} />

                <div className="mt-4">
                  <div className="field-label mb-2">{t("perms_view")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {grantedPerms.length ? grantedPerms.map((label, i) => (
                      <span key={i} className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{label}</span>
                    )) : <span className="text-xs txt-muted">{t("common_none")}</span>}
                  </div>
                </div>

                <TrainingProgressSection userId={p.id} />

                <div className="flex flex-col gap-2 mt-5">
                  {can("users.edit") && (
                    <button className="btn btn-primary w-full justify-center" onClick={() => setEditing(true)}><Icon name="edit" size={14} />{t("common_edit")}</button>
                  )}
                  {can("users.edit") && (
                    <button className="btn btn-outline w-full justify-center" onClick={resetPassword}><Icon name="lock" size={14} />{t("users_reset_password")}</button>
                  )}
                  {can("trainees.deactivate") && (
                    <button className={`btn w-full justify-center ${p.active === false ? "btn-outline" : "btn-danger"}`} onClick={toggleActive}>
                      {p.active === false ? t("users_activate") : t("users_deactivate")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="field-label">{t("common_name")}</label>
                  <input className="field-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">{lang === "ar" ? "البريد الإلكتروني" : "Email"}</label>
                  <input type="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">{t("field_employee_id")}</label>
                  <input className="field-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">{t("field_job_title")}</label>
                  <input className="field-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">{t("field_mobile")}</label>
                  <input className="field-input" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">{t("common_department")}</label>
                  <select className="field-input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">{t("users_role")}</label>
                  <select className="field-input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                    {(roles || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                {selectedRoleIsTrainee && (
                  <div>
                    <label className="field-label">{t("field_trainer")}</label>
                    <select className="field-input" value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
                      <option value="">{t("trainer_none")}</option>
                      {trainerOptions.map((tr) => <option key={tr.id} value={tr.id}>{tr.fullName}</option>)}
                    </select>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  {t("users_active")}
                </label>

                {can("users.rolesAssign") && (
                  <div>
                    <button className="flex items-center justify-between w-full text-xs font-bold" style={{ color: "var(--teal-dark)" }} onClick={() => setShowAdvanced((v) => !v)}>
                      {t("perms_customize")}
                      <Icon name={showAdvanced ? "chevronLeft" : "chevronRight"} size={13} />
                    </button>
                    {showAdvanced && (
                      <div className="mt-3 space-y-3">
                        <div className="text-[11px] txt-muted">{t("perms_override_note")}</div>
                        {PERMISSION_GROUPS.map((g) => (
                          <div key={g.key}>
                            <div className="text-[11px] font-bold mb-1.5">{groupLabel(g, lang)}</div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {g.perms.map((s) => {
                                const key = `${g.key}.${s}`;
                                const roleDefault = !!(roles.find((r) => r.id === roleId)?.permissions || {})[key];
                                const effective = key in overrides ? overrides[key] : roleDefault;
                                return (
                                  <label key={key} className="flex items-center gap-1.5 text-xs">
                                    <input type="checkbox" checked={effective} onChange={(e) => setOverrides((o) => ({ ...o, [key]: e.target.checked }))} />
                                    {permLabel(s, lang)}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {Object.keys(overrides).length > 0 && (
                          <button className="text-[11px] font-semibold underline" style={{ color: "var(--red)" }} onClick={() => setOverrides({})}>{t("perms_reset")}</button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {error && <div className="text-xs rounded-lg p-2.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</div>}
                <div className="flex gap-2">
                  <button className="btn btn-ghost flex-1 justify-center" onClick={() => setEditing(false)}>{t("common_cancel")}</button>
                  <button className="btn btn-primary flex-1 justify-center" disabled={busy || !fullName.trim() || !email.trim()} onClick={save}>{busy ? t("common_loading") : t("common_save")}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
