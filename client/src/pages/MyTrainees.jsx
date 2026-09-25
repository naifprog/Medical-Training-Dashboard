import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUI } from "../context/UIContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";

export default function MyTrainees() {
  const { t } = useUI();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  // GET /users is already scoped server-side (Phase 2): a Trainer only
  // ever receives trainees whose trainer_id matches them.
  const { data, loading } = useFetch(() => api.get("/users"), []);
  const users = data?.users ?? [];
  const filtered = users.filter((u) =>
    !q || (u.fullName + " " + (u.email || "")).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <h1 className="font-head text-2xl font-bold mb-6">{t("my_trainees_title")}</h1>

      <div className="relative mb-6 max-w-sm">
        <Icon name="search" size={16} className="absolute top-1/2 -translate-y-1/2 ms-3 txt-muted" />
        <input className="field-input" style={{ paddingInlineStart: "2.2rem" }} placeholder={t("users_search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("common_name")}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("common_department")}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("users_active")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={3} className="p-6 text-center text-sm txt-muted">{t("common_loading")}</td></tr>}
              {!loading && filtered.map((u) => (
                <tr key={u.id} className="border-t b-border cursor-pointer hover:surface2" onClick={() => navigate(`/trainees/${u.id}`)}>
                  <td className="p-3">
                    <div className="font-medium">{u.fullName}</div>
                    <div className="text-xs txt-muted">{u.email}</div>
                  </td>
                  <td className="p-3 text-xs">{u.departmentName || "—"}</td>
                  <td className="p-3">
                    {u.active === false
                      ? <span className="badge badge-fail">{t("users_deactivated")}</span>
                      : <span className="badge badge-pass">{t("users_active")}</span>}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-sm txt-muted">{t("my_trainees_empty")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
