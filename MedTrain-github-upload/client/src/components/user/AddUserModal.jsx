import { useState } from "react";
import Icon from "../Icon";
import { useUI } from "../../context/UIContext";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError } from "../../api/client";
import { PERMISSION_GROUPS, groupLabel, permLabel } from "../../i18n/strings";

export default function AddUserModal({ roles, departments, onClose, onCreated }) {
  const { t, lang } = useUI();
  const { can } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState(departments?.[0]?.id || "");
  const defaultRole = roles.find((r) => (r.name || "").toLowerCase() === "trainee") || roles[0];
  const [roleId, setRoleId] = useState(defaultRole?.id || "");
  const [active, setActive] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [mobile, setMobile] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [overrides, setOverrides] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  async function add() {
    setBusy(true);
    setError("");
    try {
      const { user, emailSent, activationUrl } = await api.post("/users", {
        fullName: fullName.trim(), email: email.trim(), departmentId, roleId, active,
        employeeId, mobile, jobTitle, permissionOverrides: overrides,
      });
      setCreated({ user, emailSent, activationUrl });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function copyActivationLink() {
    try { navigator.clipboard.writeText(created.activationUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  const selectedRole = roles.find((r) => r.id === roleId);
  const rolePerms = selectedRole?.permissions || {};
  const grantedPerms = PERMISSION_GROUPS.flatMap((g) => g.perms
    .filter((s) => !!rolePerms[`${g.key}.${s}`])
    .map((s) => `${groupLabel(g, lang)} · ${permLabel(s, lang)}`));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        {created ? (
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: "var(--green-bg)", color: "var(--green)" }}>
              <Icon name="check" size={26} />
            </div>
            <h3 className="font-head font-bold text-lg mb-2">{t("account_setup_title")}</h3>
            <p className="text-sm txt-muted mb-4">
              {created.emailSent ? t("account_setup_email_sent") : t("account_setup_dev_only")}
            </p>
            {created.activationUrl && (
              <div className="text-xs rounded-xl py-3 px-3 mb-4 break-all font-mono text-start" style={{ background: "var(--surface-2)", color: "var(--teal-dark)" }}>{created.activationUrl}</div>
            )}
            <div className="flex items-center gap-2">
              {created.activationUrl && (
                <button className="btn btn-outline flex-1 justify-center" onClick={copyActivationLink}><Icon name="download" size={14} />{copied ? (lang === "ar" ? "تم النسخ" : "Copied") : t("common_copy_link")}</button>
              )}
              <button className="btn btn-primary flex-1 justify-center" onClick={() => onCreated(created.user)}>{t("common_close")}</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-head font-bold">{t("users_add")}</h3>
              <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
            </div>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pe-1">
              <div>
                <label className="field-label">{t("common_name")} *</label>
                <input className="field-input" autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">{lang === "ar" ? "البريد الإلكتروني" : "Email"} *</label>
                <input type="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@hospital.com" />
              </div>
              <div>
                <label className="field-label">{t("common_department")}</label>
                <select className="field-input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="text-[11px] txt-muted rounded-lg p-2.5" style={{ background: "var(--teal-soft)", color: "var(--teal-dark)" }}>
                {lang === "ar"
                  ? `سيُضاف كـ "${defaultRole?.name || "—"}" افتراضيًا. تقدر تغيّر الدور أو تضيف تفاصيل إضافية بالأسفل.`
                  : `Will be added as "${defaultRole?.name || "—"}" by default. You can change the role or add more details below.`}
              </div>

              <button className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--teal-dark)" }} onClick={() => setShowMore((v) => !v)}>
                <Icon name={showMore ? "chevronLeft" : "chevronRight"} size={13} />
                {lang === "ar" ? "تفاصيل إضافية (اختياري)" : "More details (optional)"}
              </button>

              {showMore && (
                <div className="space-y-4 surface2 rounded-xl p-3">
                  <div>
                    <label className="field-label">{t("field_employee_id")}</label>
                    <input className="field-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">{t("field_mobile")}</label>
                    <input className="field-input" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">{t("field_job_title")}</label>
                    <input className="field-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                    {t("users_active")}
                  </label>

                  <div>
                    <label className="field-label">{t("users_role")}</label>
                    <select className="field-input" value={roleId} onChange={(e) => { setRoleId(e.target.value); setOverrides({}); }}>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>

                  {roleId && (
                    <div className="rounded-xl p-3" style={{ background: "var(--surface)" }}>
                      <div className="field-label mb-2">{t("perms_view")}</div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {grantedPerms.length ? grantedPerms.map((label, i) => (
                          <span key={i} className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{label}</span>
                        )) : <span className="text-xs txt-muted">{t("common_none")}</span>}
                      </div>

                      {can("users.rolesAssign") && (
                        <div className="border-t b-border pt-2 mt-2">
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
                                      const roleDefault = !!rolePerms[key];
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
                    </div>
                  )}
                </div>
              )}

              {error && <div className="text-xs rounded-lg p-2.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</div>}

              <button className="btn btn-primary w-full justify-center" disabled={busy || !roleId || !fullName.trim() || !email.trim()} onClick={add}>{busy ? t("common_loading") : t("users_add")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
