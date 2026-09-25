import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api, ApiError } from "../api/client";
import Icon from "../components/Icon";
import { fmtDate, fmtDateOnly } from "../utils/youtube";
import { trainingStatus } from "../utils/training";

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b b-border last:border-0 gap-3">
      <span className="text-xs txt-muted">{label}</span>
      <span className="text-sm font-medium text-end">{value}</span>
    </div>
  );
}

function AddTrainingForm({ availableDevices, onAssign, onCancel }) {
  const { t, lang } = useUI();
  const [deviceId, setDeviceId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!deviceId) return;
    setBusy(true);
    setError("");
    try {
      await onAssign(deviceId, dueDate || null);
      setDeviceId("");
      setDueDate("");
      onCancel();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4 space-y-3 mb-4">
      <div>
        <label className="field-label">{t("training_select_device")}</label>
        <select className="field-input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">{t("training_select_device")}</option>
          {availableDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label">{t("field_due_date")} ({lang === "ar" ? "اختياري" : "optional"})</label>
        <input type="date" className="field-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      {error && <div className="text-xs rounded-lg p-2.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</div>}
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>{t("common_cancel")}</button>
        <button className="btn btn-primary btn-sm" disabled={!deviceId || busy} onClick={submit}>
          {busy ? t("common_loading") : t("common_add")}
        </button>
      </div>
    </div>
  );
}

// Top-level component (not nested inside TraineeProfile) so its internal
// state (editingDue, showAttempts) survives re-renders of the parent.
function TrainingRow({ a, device, progress, canCancel, canEditDue, onCancel, onUpdateDueDate, onOpenDevice }) {
  const { t, lang } = useUI();
  const [editingDue, setEditingDue] = useState(false);
  const [duePick, setDuePick] = useState(a.dueDate || "");
  const [showAttempts, setShowAttempts] = useState(false);
  const attempts = progress?.quizAttempts || [];
  const status = trainingStatus(a, progress);

  const statusBadge = {
    completed: <span className="badge badge-pass"><Icon name="check" size={11} />{t("training_all_done")}</span>,
    overdue: <span className="badge badge-fail">{t("training_overdue")}</span>,
    in_progress: <span className="badge" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>{t("track_in_progress")}</span>,
    not_started: <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{t("track_not_started")}</span>,
    cancelled: <span className="badge badge-fail">{t("training_status_cancelled")}</span>,
  }[status];

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {device?.imagePath ? (
          <img src={device.imagePath} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 surface2" />
        ) : (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--teal-soft)", color: "var(--teal-dark)" }}>
            <Icon name="devices" size={18} />
          </div>
        )}
        <div className="flex-1 min-w-[160px]">
          <div className="font-semibold text-sm">{device?.name || "—"}</div>
          <div className="text-xs txt-muted mt-0.5">{device?.departmentName || "—"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {statusBadge}
          {progress?.quizBestScore != null && (
            <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{progress.quizBestScore}%</span>
          )}
          {editingDue ? (
            <span className="flex items-center gap-1.5">
              <input type="date" className="field-input" style={{ width: "auto", padding: ".3rem .5rem" }} value={duePick} onChange={(e) => setDuePick(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={async () => { await onUpdateDueDate(a.id, duePick); setEditingDue(false); }}>{t("common_save")}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingDue(false)}>{t("common_cancel")}</button>
            </span>
          ) : (
            <span className="txt-muted flex items-center gap-1">
              {a.dueDate ? `${t("field_due_date")}: ${fmtDateOnly(a.dueDate, lang)}` : t("field_due_date")}
              {a.status === "active" && canEditDue && (
                <button className="icon-btn" style={{ width: 20, height: 20 }} title={t("field_edit_due_date")} onClick={() => { setDuePick(a.dueDate || ""); setEditingDue(true); }}>
                  <Icon name="edit" size={11} />
                </button>
              )}
            </span>
          )}
          {a.status === "active"
            ? <span className="txt-muted">{t("field_assigned_date")}: {fmtDate(a.assignedAt, lang)}</span>
            : <span className="txt-muted">{t("field_cancelled_date")}: {fmtDate(a.cancelledAt, lang)}</span>}
        </div>
        {attempts.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAttempts((v) => !v)}>
            <Icon name={showAttempts ? "chevronLeft" : "chevronRight"} size={13} />{t("quiz_attempt_history")} ({attempts.length})
          </button>
        )}
        {a.status === "active" && canCancel && (
          <button className="btn btn-ghost btn-sm" onClick={() => onCancel(a.deviceId)}>
            <Icon name="x" size={13} />{t("training_cancel")}
          </button>
        )}
        {device && (
          <button className="btn btn-outline btn-sm" onClick={() => onOpenDevice(device.id)}>
            {lang === "ar" ? "فتح الجهاز" : "Open Device"}
          </button>
        )}
      </div>
      {showAttempts && (
        <div className="surface2 rounded-lg p-3 space-y-1.5">
          {[...attempts].reverse().map((att, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="txt-muted">{fmtDate(att.at, lang)}</span>
              <span className={att.passed ? "badge badge-pass" : "badge badge-fail"}>{att.score}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TraineeProfile() {
  const { id } = useParams();
  const { t, lang } = useUI();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [changingTrainer, setChangingTrainer] = useState(false);
  const [trainerPick, setTrainerPick] = useState("");
  const [trainerBusy, setTrainerBusy] = useState(false);

  const { data: userData, error: userError, setData: setUserData } = useFetch(() => api.get(`/users/${id}`), [id]);
  const { data: allUsersData } = useFetch(() => (can("users.edit") ? api.get("/users") : Promise.resolve(null)), [id]);
  const { data: devicesData } = useFetch(() => api.get("/devices"), []);
  const { data: assignData, reload: reloadAssignments } = useFetch(() => api.get(`/assignments?userId=${id}`), [id]);
  const { data: progressData } = useFetch(() => api.get(`/progress/user/${id}`), [id]);

  const trainee = userData?.user;
  const devices = devicesData?.devices ?? [];
  const assignments = assignData?.assignments ?? [];
  const progress = progressData?.progress ?? [];
  const trainers = (allUsersData?.users || []).filter((u) => u.roleName === "Trainer" && u.active !== false);

  if (userError) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="card p-6 text-sm" style={{ color: "var(--red)" }}>
          {userError instanceof ApiError ? userError.message : t("trainee_not_authorized")}
        </div>
        <button className="btn btn-outline mt-4" onClick={() => navigate(-1)}>{t("common_back")}</button>
      </div>
    );
  }
  if (!trainee) return <div className="p-8 txt-muted text-sm">{t("common_loading")}</div>;

  function deviceById(deviceId) { return devices.find((d) => d.id === deviceId); }
  function progressFor(deviceId) { return progress.find((p) => p.deviceId === deviceId); }

  const active = assignments.filter((a) => a.status === "active");
  const history = assignments.filter((a) => a.status !== "active");
  const activeDeviceIds = new Set(active.map((a) => a.deviceId));
  // Inactive devices are also rejected server-side (409) if picked anyway --
  // this filter is just the matching UI convenience.
  const availableDevices = devices.filter((d) => !activeDeviceIds.has(d.id) && d.active !== false);

  async function assignDevice(deviceId, dueDate) {
    await api.post("/assignments", { userId: id, deviceId, dueDate });
    reloadAssignments();
  }

  async function cancelAssignment(deviceId) {
    if (!confirm(lang === "ar" ? "إلغاء هذا التدريب؟ سيبقى سجله محفوظًا." : "Cancel this training? Its history will be preserved.")) return;
    await api.del("/assignments", { userId: id, deviceId });
    reloadAssignments();
  }

  async function updateDueDate(assignmentId, dueDate) {
    await api.put(`/assignments/${assignmentId}`, { dueDate: dueDate || null });
    reloadAssignments();
  }

  async function saveTrainer() {
    setTrainerBusy(true);
    try {
      const { user: updated } = await api.put(`/users/${id}`, { trainerId: trainerPick || null });
      setUserData({ user: updated });
      setChangingTrainer(false);
    } finally {
      setTrainerBusy(false);
    }
  }

  const canCancel = can("assignments.cancel");
  const canEditDue = can("assignments.edit");

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <button className="flex items-center gap-1.5 text-xs txt-muted mb-4 font-semibold" onClick={() => navigate(-1)}>
        <Icon name={lang === "ar" ? "chevronRight" : "chevronLeft"} size={14} />{t("common_back")}
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 rounded-full surface2 flex items-center justify-center text-lg font-bold">{(trainee.fullName || "?").slice(0, 1)}</div>
        <div>
          <h1 className="font-head text-xl md:text-2xl font-bold">{trainee.fullName}</h1>
          <div className="text-xs txt-muted mt-0.5">{trainee.email || "—"}</div>
        </div>
        <div className="flex-1" />
        {trainee.active === false
          ? <span className="badge badge-fail">{t("users_deactivated")}</span>
          : <span className="badge badge-pass">{t("users_active")}</span>}
      </div>

      <div className="card p-5 mb-6">
        <Row label={t("field_employee_id")} value={trainee.employeeId || "—"} />
        <Row label={t("field_job_title")} value={trainee.jobTitle || "—"} />
        <Row label={t("field_mobile")} value={trainee.mobile || "—"} />
        <Row label={t("common_department")} value={trainee.departmentName || "—"} />
        <Row
          label={t("field_trainer")}
          value={changingTrainer ? (
            <span className="flex items-center gap-2">
              <select className="field-input" style={{ width: "auto" }} value={trainerPick} onChange={(e) => setTrainerPick(e.target.value)}>
                <option value="">{t("trainer_none")}</option>
                {trainers.map((tr) => <option key={tr.id} value={tr.id}>{tr.fullName}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={trainerBusy} onClick={saveTrainer}>{t("common_save")}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setChangingTrainer(false)}>{t("common_cancel")}</button>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {trainee.trainerName || t("trainer_none")}
              {can("users.edit") && (
                <button className="icon-btn" onClick={() => { setTrainerPick(trainee.trainerId || ""); setChangingTrainer(true); }}>
                  <Icon name="edit" size={13} />
                </button>
              )}
            </span>
          )}
        />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-head font-semibold flex-1">{t("training_active")}</h2>
        {can("assignments.create") && !showAdd && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Icon name="plus" size={14} />{t("training_add")}</button>
        )}
      </div>
      {showAdd && <AddTrainingForm availableDevices={availableDevices} onAssign={assignDevice} onCancel={() => setShowAdd(false)} />}
      <div className="space-y-3 mb-8">
        {active.length === 0 && <div className="card p-5 text-sm txt-muted text-center">{t("training_none_active")}</div>}
        {active.map((a) => (
          <TrainingRow
            key={a.id} a={a} device={deviceById(a.deviceId)} progress={progressFor(a.deviceId)}
            canCancel={canCancel} canEditDue={canEditDue}
            onCancel={cancelAssignment} onUpdateDueDate={updateDueDate}
            onOpenDevice={(deviceId) => navigate(`/devices/${deviceId}`)}
          />
        ))}
      </div>

      <h2 className="font-head font-semibold mb-3">{t("training_history")}</h2>
      <div className="space-y-3">
        {history.length === 0 && <div className="card p-5 text-sm txt-muted text-center">{t("training_none_history")}</div>}
        {history.map((a) => (
          <TrainingRow
            key={a.id} a={a} device={deviceById(a.deviceId)} progress={progressFor(a.deviceId)}
            canCancel={canCancel} canEditDue={canEditDue}
            onCancel={cancelAssignment} onUpdateDueDate={updateDueDate}
            onOpenDevice={(deviceId) => navigate(`/devices/${deviceId}`)}
          />
        ))}
      </div>
    </div>
  );
}
