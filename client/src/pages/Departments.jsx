import { useState } from "react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api, ApiError } from "../api/client";
import Icon from "../components/Icon";

export default function Departments() {
  const { t, lang } = useUI();
  const { can } = useAuth();
  const { data, reload } = useFetch(() => api.get("/departments"), []);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const departments = data?.departments ?? [];

  const canManage = can("devices.create") || can("devices.edit");
  const canDelete = can("devices.delete");

  async function add() {
    if (!name.trim()) return;
    setError("");
    try {
      await api.post("/departments", { name: name.trim() });
      setName("");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function saveEdit(id) {
    if (!editingName.trim()) return;
    await api.put(`/departments/${id}`, { name: editingName.trim() });
    setEditingId(null);
    reload();
  }

  async function del(id) {
    const usage = await api.get(`/departments/${id}/usage`);
    const inUse = usage.userCount > 0 || usage.deviceCount > 0;
    const msg = inUse
      ? `${t("dept_delete_warn")} (${usage.userCount} ${lang === "ar" ? "مستخدم" : "users"}, ${usage.deviceCount} ${lang === "ar" ? "جهاز" : "devices"})`
      : (lang === "ar" ? "حذف هذا القسم؟" : "Delete this department?");
    if (!confirm(msg)) return;
    await api.del(`/departments/${id}`);
    reload();
  }

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-head text-2xl font-bold mb-6">{t("dept_title")}</h1>

      {canManage && (
        <div className="card p-4 mb-6 flex gap-2">
          <input className="field-input" placeholder={t("dept_name")} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn btn-primary shrink-0" disabled={!name.trim()} onClick={add}><Icon name="plus" size={16} />{t("dept_add")}</button>
        </div>
      )}
      {error && <div className="text-xs mb-4 rounded-lg p-2.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</div>}

      <div className="card divide-y" style={{ borderColor: "var(--border)" }}>
        {departments.map((d) => (
          <div key={d.id} className="flex items-center gap-3 p-3.5">
            {editingId === d.id ? (
              <>
                <input className="field-input flex-1" value={editingName} onChange={(e) => setEditingName(e.target.value)} autoFocus />
                <button className="btn btn-primary btn-sm" onClick={() => saveEdit(d.id)}>{t("common_save")}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>{t("common_cancel")}</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium">{d.name}</span>
                {canManage && (
                  <button className="icon-btn" onClick={() => { setEditingId(d.id); setEditingName(d.name); }}><Icon name="edit" size={14} /></button>
                )}
                {canDelete && (
                  <button className="icon-btn" onClick={() => del(d.id)}><Icon name="trash" size={14} /></button>
                )}
              </>
            )}
          </div>
        ))}
        {departments.length === 0 && <div className="p-6 text-center text-sm txt-muted">{t("common_none")}</div>}
      </div>
    </div>
  );
}
