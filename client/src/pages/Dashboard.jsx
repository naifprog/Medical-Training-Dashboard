import { useNavigate } from "react-router-dom";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";
import { fmtDateOnly } from "../utils/youtube";
import { trainingStatus } from "../utils/training";

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

// Shared by Administrator AND Trainer: the underlying API calls
// (/users, /assignments, /progress) are already permission/scope-aware
// (Phase 2), so this single component naturally shows org-wide numbers for
// an Administrator and only-my-trainees numbers for a Trainer -- no
// role-name branching needed for the data itself, only for which tiles
// make sense to display (e.g. "Total Trainers" is meaningless for a
// Trainer looking at their own already-filtered trainee list).
function ManagementDashboard() {
  const { t, lang } = useUI();
  const { can, user } = useAuth();
  const isOrgWide = can("trainees.viewAll");

  // Keyed on user.id so switching the authenticated account (e.g. via the
  // DevSwitcher's real re-login) always refetches scoped data instead of
  // leaving the previous account's numbers on screen -- an empty deps array
  // here would only ever fetch once, on first mount.
  const { data: usersData, loading: usersLoading, error: usersError } = useFetch(() => api.get("/users"), [user.id]);
  const { data: devicesData, loading: devicesLoading } = useFetch(() => api.get("/devices"), [user.id]);
  const { data: assignData, loading: assignLoading, error: assignError } = useFetch(() => api.get("/assignments"), [user.id]);
  const { data: progressData, loading: progLoading, error: progError } = useFetch(() => api.get("/progress"), [user.id]);

  const loading = usersLoading || devicesLoading || assignLoading || progLoading;
  const error = usersError || assignError || progError;

  if (loading) return <div className="p-8 txt-muted text-sm">{t("common_loading")}</div>;
  if (error) return <div className="p-8 text-sm" style={{ color: "var(--red)" }}>{t("reports_empty")}</div>;

  const users = usersData?.users ?? [];
  const devices = devicesData?.devices ?? [];
  const assignments = assignData?.assignments ?? [];
  const progress = progressData?.progress ?? [];

  const trainees = users.filter((u) => u.roleName === "Trainee");
  const trainers = users.filter((u) => u.roleName === "Trainer");
  const progressFor = (userId, deviceId) => progress.find((p) => p.userId === userId && p.deviceId === deviceId);

  const activeAssignments = assignments.filter((a) => a.status === "active");
  let completed = 0;
  for (const a of activeAssignments) {
    const status = trainingStatus(a, progressFor(a.userId, a.deviceId));
    if (status === "completed") completed++;
  }
  const completionRate = activeAssignments.length ? Math.round((completed / activeAssignments.length) * 100) : 0;

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <h1 className="font-head text-2xl font-bold mb-1">{t("nav_dashboard")}</h1>
      <p className="txt-muted text-sm mb-6">{isOrgWide ? (lang === "ar" ? "نظرة عامة على المؤسسة" : "Organization overview") : (lang === "ar" ? "نظرة عامة على متدربيك" : "Overview of your trainees")}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {isOrgWide ? (
          <>
            <StatCard icon="users" label={t("stat_total_trainees")} value={trainees.length} tint="var(--amber-bg)" />
            <StatCard icon="cap" label={t("stat_total_trainers")} value={trainers.length} />
            <StatCard icon="devices" label={t("nav_devices")} value={devices.length} />
            <StatCard icon="check" label={t("stat_completion_rate")} value={`${completionRate}%`} tint="var(--green-bg)" />
          </>
        ) : (
          <>
            <StatCard icon="users" label={t("nav_my_trainees")} value={trainees.length} tint="var(--amber-bg)" />
            <StatCard icon="activity" label={t("stat_active_trainings")} value={activeAssignments.length} />
            <StatCard icon="award" label={t("stat_completed_trainings")} value={completed} tint="var(--green-bg)" />
            <StatCard icon="check" label={t("stat_completion_rate")} value={`${completionRate}%`} tint="var(--green-bg)" />
          </>
        )}
      </div>
    </div>
  );
}

function TraineeDashboard() {
  const { t, lang } = useUI();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: devicesData, loading: devicesLoading } = useFetch(() => api.get("/devices"), [user.id]);
  const { data: assignData, loading: assignLoading } = useFetch(() => api.get(`/assignments?userId=${user.id}`), [user.id]);
  const { data: progressData, loading: progLoading } = useFetch(() => api.get("/progress/mine"), [user.id]);

  if (devicesLoading || assignLoading || progLoading) return <div className="p-8 txt-muted text-sm">{t("common_loading")}</div>;

  const devices = devicesData?.devices ?? [];
  const assignments = (assignData?.assignments ?? []).filter((a) => a.status === "active");
  const progress = progressData?.progress ?? [];
  const deviceById = (id) => devices.find((d) => d.id === id);
  const progressFor = (deviceId) => progress.find((p) => p.deviceId === deviceId);

  const withStatus = assignments.map((a) => ({ a, pr: progressFor(a.deviceId), status: trainingStatus(a, progressFor(a.deviceId)) }));
  const notStarted = withStatus.filter((x) => x.status === "not_started");
  const inProgress = withStatus.filter((x) => x.status === "in_progress");
  const completed = withStatus.filter((x) => x.status === "completed");
  const overdue = withStatus.filter((x) => x.status === "overdue");
  const remaining = notStarted.length + inProgress.length;
  const completionRate = assignments.length ? Math.round((completed.length / assignments.length) * 100) : 0;
  const continueItem = [...overdue, ...inProgress, ...notStarted][0];
  const upcoming = withStatus
    .filter((x) => x.a.dueDate && x.status !== "completed")
    .sort((x, y) => x.a.dueDate.localeCompare(y.a.dueDate))
    .slice(0, 4);

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <h1 className="font-head text-2xl font-bold mb-1">{t("my_training")}</h1>
      <p className="txt-muted text-sm mb-6">{user?.departmentName}</p>

      {continueItem && (
        <div className="card p-4 mb-6 flex items-center gap-3 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/devices/${continueItem.a.deviceId}`)}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--teal)", color: "#fff" }}>
            <Icon name="video" size={20} />
          </div>
          <div className="flex-1">
            <div className="text-xs txt-muted">{lang === "ar" ? "أكمل تدريبك" : "Continue Training"}</div>
            <div className="font-semibold text-sm">{deviceById(continueItem.a.deviceId)?.name || "—"}</div>
          </div>
          <Icon name={lang === "ar" ? "chevronLeft" : "chevronRight"} size={16} />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard icon="clock" label={t("stat_assigned_trainings")} value={assignments.length} />
        <StatCard icon="activity" label={t("stat_remaining_trainings")} value={remaining} tint="var(--amber-bg)" />
        <StatCard icon="award" label={t("stat_completed_trainings")} value={completed.length} tint="var(--green-bg)" />
        <StatCard icon="check" label={t("stat_completion_rate")} value={`${completionRate}%`} tint="var(--green-bg)" />
      </div>

      <div className="mb-8">
        <h2 className="font-head font-semibold mb-3">{lang === "ar" ? "المواعيد القادمة" : "Upcoming due dates"}</h2>
        <div className="card overflow-hidden">
          {upcoming.length === 0 ? (
            <div className="p-5 text-sm txt-muted text-center">{t("common_none")}</div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {upcoming.map(({ a, status }) => (
                <div key={a.id} className="p-3 flex items-center justify-between gap-2 text-sm cursor-pointer hover:surface2" onClick={() => navigate(`/devices/${a.deviceId}`)}>
                  <span className="font-medium">{deviceById(a.deviceId)?.name || "—"}</span>
                  <span className={status === "overdue" ? "badge badge-fail" : "badge badge-dept"}>{fmtDateOnly(a.dueDate, lang)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2 className="font-head font-semibold mb-3">{t("training_active")}</h2>
      <div className="space-y-2">
        {assignments.length === 0 && <div className="card p-5 text-sm txt-muted text-center">{t("training_none_active")}</div>}
        {assignments.map((a) => {
          const d = deviceById(a.deviceId);
          const status = trainingStatus(a, progressFor(a.deviceId));
          const badge = {
            completed: <span className="badge badge-pass">{t("track_completed")}</span>,
            overdue: <span className="badge badge-fail">{t("training_overdue")}</span>,
            in_progress: <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>{t("track_in_progress")}</span>,
            not_started: <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{t("track_not_started")}</span>,
          }[status];
          return (
            <div key={a.id} className="card p-4 flex items-center gap-3 cursor-pointer hover:surface2" onClick={() => navigate(`/devices/${a.deviceId}`)}>
              {d?.imagePath ? (
                <img src={d.imagePath} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 surface2" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--teal-soft)", color: "var(--teal-dark)" }}>
                  <Icon name="devices" size={18} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{d?.name || "—"}</div>
                {a.dueDate && <div className="text-xs txt-muted mt-0.5">{t("field_due_date")}: {fmtDateOnly(a.dueDate, lang)}</div>}
              </div>
              {badge}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { can } = useAuth();
  const managementAccess = can("devices.create") || can("devices.edit") || can("reports.view");
  return managementAccess ? <ManagementDashboard /> : <TraineeDashboard />;
}
