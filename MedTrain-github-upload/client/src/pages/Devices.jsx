import { useMemo, useState } from "react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";
import DeviceGrid from "../components/DeviceGrid";
import DeviceForm from "../components/DeviceForm";

export default function Devices() {
  const { t } = useUI();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const canEdit = can("devices.create") || can("devices.edit");

  const { data: devicesData, reload } = useFetch(() => api.get("/devices"), []);
  const { data: deptData } = useFetch(() => api.get("/departments"), []);
  const devices = devicesData?.devices ?? null;
  const departments = deptData?.departments ?? [];

  const filtered = useMemo(() => {
    if (!devices) return devices;
    return devices.filter((d) =>
      (dept === "all" || d.departmentId === dept) &&
      (!q || (d.name + " " + (d.description || "")).toLowerCase().includes(q.toLowerCase()))
    );
  }, [devices, dept, q]);

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="font-head text-2xl font-bold flex-1">{t("devices_title")}</h1>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Icon name="plus" size={16} />{t("devices_add")}</button>}
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Icon name="search" size={16} className="absolute top-1/2 -translate-y-1/2 ms-3 txt-muted" />
          <input className="field-input" style={{ paddingInlineStart: "2.2rem" }} placeholder={t("common_search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="field-input w-auto" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">{t("common_all")}</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <DeviceGrid devices={filtered} progress={null} />
      {showForm && (
        <DeviceForm
          departments={departments}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload(); }}
        />
      )}
    </div>
  );
}
