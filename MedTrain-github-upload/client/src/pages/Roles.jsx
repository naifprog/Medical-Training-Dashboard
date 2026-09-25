import { useState } from "react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api, ApiError } from "../api/client";
import Icon from "../components/Icon";
import { PERMISSION_GROUPS, groupLabel, permLabel } from "../i18n/strings";

function RoleEditor({ role, onClose, onSaved }) {
  const { t, lang } = useUI();
  const [name, setName] = useState(role?.name || "");
  const [permissions, setPermissions] = useState(role?.permissions || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(key) { setPermissions((p) => ({ ...p, [key]: !p[key] })); }

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (role) {
        const { role: updated } = await api.put(`/roles/${role.id}`, { name, permissions });
        onSaved(updated);
      } else {
        const { role: created } = await api.post("/roles", { name, permissions });
        onSaved(created);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card w-full max-w-xl p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b b-border">
          <h3 className="font-head font-bold">{role ? t("common_edit") : t("roles_add")}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
          <div>
            <label className="field-label">{t("roles_name")}</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.key} className="surface2 rounded-xl p-3">
              <div className="text-xs font-bold mb-2">{groupLabel(g, lang)}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {g.perms.map((p) => {
                  const key = `${g.key}.${p}`;
                  return (
                    <label key={key} className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={!!permissions[key]} onChange={() => toggle(key)} />
                      {permLabel(p, lang)}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {error && <div className="text-xs rounded-lg p-2.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t b-border">
          <button className="btn btn-ghost" onClick={onClose}>{t("common_cancel")}</button>
          <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>{busy ? t("common_loading") : t("common_save")}</button>
        </div>
      </div>
    </div>
  );
}

export default function Roles() {
  const { t } = useUI();
  const { can } = useAuth();
  const { data, loading, reload } = useFetch(() => api.get("/roles"), []);
  const roles = data?.roles ?? [];
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  async function del(role) {
    if (!confirm(t("roles_delete") + "?")) return;
    try {
      await api.del(`/roles/${role.id}`);
      reload();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-head text-2xl font-bold flex-1">{t("roles_title")}</h1>
        {can("users.rolesCreate") && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Icon name="plus" size={16} />{t("roles_add")}</button>
        )}
      </div>
      {loading && <div className="p-6 text-center text-sm txt-muted card">{t("common_loading")}</div>}
      <div className="grid sm:grid-cols-2 gap-4">
        {!loading && roles.map((r) => {
          const count = Object.values(r.permissions || {}).filter(Boolean).length;
          return (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-head font-semibold text-sm">{r.name}</div>
                  <div className="text-xs txt-muted mt-0.5">{count} permissions</div>
                </div>
                <div className="flex gap-1.5">
                  {can("users.rolesEdit") && (
                    <button className="icon-btn" onClick={() => setEditing(r)}><Icon name="edit" size={14} /></button>
                  )}
                  {can("users.rolesDelete") && !r.is_system && (
                    <button className="icon-btn" onClick={() => del(r)}><Icon name="trash" size={14} /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {editing && (
        <RoleEditor role={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
      {showCreate && (
        <RoleEditor onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); reload(); }} />
      )}
    </div>
  );
}
