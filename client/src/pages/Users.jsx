import { useState } from "react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";
import AddUserModal from "../components/user/AddUserModal";
import UserDetailModal from "../components/user/UserDetailModal";

export default function Users() {
  const { t } = useUI();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: usersData, reload } = useFetch(() => api.get("/users"), []);
  const { data: rolesData } = useFetch(() => api.get("/roles"), []);
  const { data: deptData } = useFetch(() => api.get("/departments"), []);

  const users = usersData?.users ?? [];
  const roles = rolesData?.roles ?? [];
  const departments = deptData?.departments ?? [];

  const filtered = users.filter((u) =>
    !q || (u.fullName + " " + (u.email || "") + " " + (u.employeeId || "")).toLowerCase().includes(q.toLowerCase())
  );

  function roleName(id) { return roles.find((r) => r.id === id)?.name || "—"; }

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="font-head text-2xl font-bold flex-1">{t("users_title")}</h1>
        {can("users.create") && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={16} />{t("users_add")}</button>
        )}
      </div>

      <div className="relative mb-6 max-w-sm">
        <Icon name="search" size={16} className="absolute top-1/2 -translate-y-1/2 ms-3 txt-muted" />
        <input className="field-input" style={{ paddingInlineStart: "2.2rem" }} placeholder={t("users_search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start" style={{ background: "var(--surface-2)" }}>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("common_name")}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("common_department")}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("users_role")}</th>
                <th className="text-start p-3 font-semibold text-xs txt-muted">{t("users_active")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t b-border cursor-pointer hover:surface2" onClick={() => setSelected(u)}>
                  <td className="p-3">
                    <div className="font-medium">{u.fullName}</div>
                    <div className="text-xs txt-muted">{u.email}</div>
                  </td>
                  <td className="p-3 text-xs">{u.departmentName || "—"}</td>
                  <td className="p-3 text-xs">{roleName(u.roleId)}</td>
                  <td className="p-3">
                    {u.active === false
                      ? <span className="badge badge-fail">{t("users_deactivated")}</span>
                      : <span className="badge badge-pass">{t("users_active")}</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-sm txt-muted">{t("common_none")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <AddUserModal
          roles={roles} departments={departments}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); reload(); }}
        />
      )}
      {selected && (
        <UserDetailModal
          userSummary={selected} roles={roles} departments={departments}
          onClose={() => setSelected(null)}
          onUpdated={() => reload()}
        />
      )}
    </div>
  );
}
