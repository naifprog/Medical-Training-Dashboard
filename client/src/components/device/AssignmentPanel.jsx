import { useEffect, useState } from "react";
import Icon from "../Icon";
import { useUI } from "../../context/UIContext";
import { api } from "../../api/client";

export default function AssignmentPanel({ device, departments, onDeviceChange }) {
  const { t, lang } = useUI();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [mine, setMine] = useState([]);

  async function loadAssignments() {
    const { assignments } = await api.get(`/devices/${device.id}/assignments`);
    setMine(assignments);
  }
  useEffect(() => { loadAssignments(); }, [device.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function search(v) {
    setQuery(v);
    const { users } = await api.get(`/users?q=${encodeURIComponent(v)}`);
    setResults(users.filter((u) => !mine.some((m) => m.userId === u.id)).slice(0, 8));
  }
  async function assign(user) {
    await api.post("/assignments", { userId: user.id, deviceId: device.id });
    setQuery(""); setResults([]);
    loadAssignments();
  }
  async function unassign(userId) {
    await api.del("/assignments", { userId, deviceId: device.id });
    loadAssignments();
  }
  async function toggleAll() {
    const { device: updated } = await api.put(`/devices/${device.id}`, { assignedToAll: !device.assignedToAll });
    onDeviceChange(updated);
  }
  async function toggleDept(id) {
    const cur = device.assignedDepartmentIds || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    const { device: updated } = await api.put(`/devices/${device.id}`, { assignedDepartmentIds: next });
    onDeviceChange(updated);
  }

  const extraDepts = (departments || []).filter((d) => d.id !== device.departmentId);

  return (
    <div className="space-y-4">
      <div className="text-xs txt-muted">{t("visibility_hint")}</div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={!!device.assignedToAll} onChange={toggleAll} />
        {lang === "ar" ? "تخصيص لجميع المتدربين" : "Assign to all trainees"}
      </label>

      {!device.assignedToAll && (
        <div>
          <div className="field-label">{lang === "ar" ? "أقسام إضافية" : "Additional departments"}</div>
          <div className="flex flex-wrap gap-2">
            {extraDepts.map((d) => {
              const on = (device.assignedDepartmentIds || []).includes(d.id);
              return (
                <button key={d.id} onClick={() => toggleDept(d.id)} className="badge" style={on ? { background: "var(--teal)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--text-muted)" }}>
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="field-label">{t("assign_add")}</div>
        <div className="relative mb-3">
          <input className="field-input" value={query} onFocus={() => search("")} onChange={(e) => search(e.target.value)} placeholder={lang === "ar" ? "ابحث بالاسم…" : "Search by name…"} />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full card p-1.5 max-h-48 overflow-y-auto">
              {results.map((r) => (
                <div key={r.id} className="px-2.5 py-1.5 rounded-lg text-sm cursor-pointer hover:surface2" onClick={() => assign(r)}>{r.fullName}</div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {mine.map((a) => (
            <span key={a.userId} className="badge surface2" style={{ color: "var(--text)" }}>
              {a.fullName}
              <button onClick={() => unassign(a.userId)}><Icon name="x" size={11} /></button>
            </span>
          ))}
          {mine.length === 0 && <span className="text-xs txt-muted">{t("common_none")}</span>}
        </div>
      </div>
    </div>
  );
}
