import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";
import DeviceGrid from "../components/DeviceGrid";

function StatCard({ icon, label, value, tint }) {
  return (
    <div className="card p-4 flex items-center gap-3.5">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint || "var(--teal-soft)", color: "var(--teal-dark)" }}>
        <Icon name={icon} size={20} />
      </div>
      <div>
        <div className="text-2xl font-head font-bold leading-none">{value}</div>
        <div className="text-xs txt-muted mt-1">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, lang } = useUI();
  const { user, can } = useAuth();
  const managementAccess = can("devices.create") || can("devices.edit") || can("reports.view");

  const { data: devicesData } = useFetch(() => api.get("/devices"), []);
  const { data: progressData } = useFetch(
    () => (managementAccess ? api.get("/progress") : api.get("/progress/mine")),
    [managementAccess]
  );
  const { data: usersData } = useFetch(() => (managementAccess ? api.get("/users") : Promise.resolve(null)), [managementAccess]);

  const devices = devicesData?.devices ?? null;
  const progress = progressData?.progress ?? [];

  if (!managementAccess) {
    const passedCount = progress.filter((p) => p.quizPassed).length;
    return (
      <div className="p-5 md:p-8 max-w-5xl mx-auto">
        <h1 className="font-head text-2xl font-bold mb-1">{t("my_training")}</h1>
        <p className="txt-muted text-sm mb-6">{user?.departmentName}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          <StatCard icon="devices" label={lang === "ar" ? "أجهزة متاحة" : "Devices available"} value={devices?.length ?? "—"} />
          <StatCard icon="award" label={lang === "ar" ? "مُجتازة" : "Completed"} value={passedCount} tint="var(--green-bg)" />
          <StatCard icon="clock" label={lang === "ar" ? "قيد الإنجاز" : "In progress"} value={Math.max((devices?.length ?? 0) - passedCount, 0)} tint="var(--amber-bg)" />
        </div>
        <h2 className="font-head font-semibold mb-3">{t("devices_title")}</h2>
        <DeviceGrid devices={devices} progress={progress} />
      </div>
    );
  }

  const totalPassed = progress.filter((p) => p.quizPassed).length;
  const activeCount = (usersData?.users || []).filter((u) => u.active !== false).length;

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <h1 className="font-head text-2xl font-bold mb-1">{t("nav_dashboard")}</h1>
      <p className="txt-muted text-sm mb-6">{user?.roleName}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard icon="devices" label={t("nav_devices")} value={devices?.length ?? "—"} />
        <StatCard icon="users" label={t("stat_total_trainees")} value={usersData?.users?.length ?? "—"} tint="var(--amber-bg)" />
        <StatCard icon="cap" label={lang === "ar" ? "مستخدمون نشطون" : "Active users"} value={activeCount} />
        <StatCard icon="award" label={lang === "ar" ? "اختبارات مُجتازة" : "Passed evaluations"} value={totalPassed} tint="var(--green-bg)" />
      </div>
      <h2 className="font-head font-semibold mb-3">{t("devices_title")}</h2>
      <DeviceGrid devices={devices ? devices.slice(0, 6) : devices} progress={progress} />
    </div>
  );
}
