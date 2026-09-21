import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";
import DeviceForm from "../components/DeviceForm";
import VideoPanel from "../components/device/VideoPanel";
import AlarmGuide from "../components/device/AlarmGuide";
import QuizPanel from "../components/device/QuizPanel";
import Certificate from "../components/device/Certificate";
import QrPanel from "../components/device/QrPanel";
import AssignmentPanel from "../components/device/AssignmentPanel";

export default function DeviceDetail() {
  const { id } = useParams();
  const { t, lang } = useUI();
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [showCert, setShowCert] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const canEdit = can("devices.create") || can("devices.edit");

  const { data: deviceData, setData: setDeviceData } = useFetch(() => api.get(`/devices/${id}`), [id]);
  const { data: deptData } = useFetch(() => api.get("/departments"), []);
  const { data: progressData, setData: setProgressData } = useFetch(() => api.get("/progress/mine"), [id]);

  const device = deviceData?.device;
  const departments = deptData?.departments ?? [];
  const progress = (progressData?.progress || []).find((p) => p.deviceId === id);

  function updateDevice(updated) { setDeviceData({ device: updated }); }
  function updateProgress(updated) {
    setProgressData((prev) => {
      const list = prev?.progress || [];
      const idx = list.findIndex((p) => p.deviceId === updated.deviceId);
      const next = idx >= 0 ? list.map((p, i) => (i === idx ? updated : p)) : [...list, updated];
      return { progress: next };
    });
  }

  if (!device) return <div className="p-8 txt-muted text-sm">{t("common_loading")}</div>;

  const tabs = [
    ["overview", t("tab_overview"), "activity"],
    ...(can("devices.assign") ? [["assign", t("assign_title"), "users"]] : []),
    ["video", t("tab_video"), "video"],
    ["alarms", t("tab_alarms"), "alert"],
    ["quiz", t("tab_quiz"), "cap"],
    ["qr", t("tab_qr"), "qr"],
  ];

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <button className="flex items-center gap-1.5 text-xs txt-muted mb-4 font-semibold" onClick={() => navigate("/devices")}>
        <Icon name={lang === "ar" ? "chevronRight" : "chevronLeft"} size={14} />{t("common_back")}
      </button>
      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "var(--teal-soft)", color: "var(--teal-dark)" }}>
          <Icon name="devices" size={26} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-head text-xl md:text-2xl font-bold">{device.name}</h1>
          {device.deviceType && <div className="text-xs txt-muted mt-0.5">{device.deviceType}</div>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {device.departmentName && <span className="badge badge-dept">{device.departmentName}</span>}
            {device.category && <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{device.category}</span>}
            {progress?.quizBestScore != null && (progress.quizPassed
              ? <span className="badge badge-pass"><Icon name="check" size={12} />{t("quiz_pass")}</span>
              : <span className="badge badge-fail">{t("quiz_fail")}</span>)}
          </div>
        </div>
        {canEdit && <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}><Icon name="edit" size={14} />{t("common_edit")}</button>}
      </div>

      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {tabs.map(([k, label, icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${tab === k ? "text-white" : "txt-muted"}`} style={tab === k ? { background: "var(--teal)" } : { background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Icon name={icon} size={14} />{label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="card p-5">
          <p className="text-sm leading-relaxed">{device.description || "—"}</p>
        </div>
      )}

      {tab === "assign" && can("devices.assign") && (
        <div className="card p-5">
          <AssignmentPanel device={device} departments={departments} onDeviceChange={updateDevice} />
        </div>
      )}

      {tab === "video" && <VideoPanel device={device} progress={progress} onProgressChange={updateProgress} />}

      {tab === "alarms" && <AlarmGuide alarms={device.alarms || []} />}

      {tab === "quiz" && (
        <QuizPanel device={device} progress={progress} onProgressChange={updateProgress} onViewCert={() => setShowCert(true)} />
      )}

      {tab === "qr" && <QrPanel device={device} />}

      {showEdit && (
        <DeviceForm
          device={device}
          departments={departments}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setShowEdit(false); updateDevice(updated); }}
          onDeleted={() => { setShowEdit(false); navigate("/devices"); }}
        />
      )}
      {showCert && <Certificate user={user} device={device} progress={progress} onClose={() => setShowCert(false)} />}
    </div>
  );
}
