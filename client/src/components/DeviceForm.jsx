import { useState } from "react";
import Icon from "./Icon";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function DeviceForm({ device, departments, onClose, onSaved, onDeleted }) {
  const { t, lang } = useUI();
  const { can } = useAuth();
  const isEdit = !!device;
  const [tab, setTab] = useState("basic");
  const [name, setName] = useState(device?.name || "");
  const [departmentId, setDepartmentId] = useState(device?.departmentId || departments?.[0]?.id || "");
  const [deviceType, setDeviceType] = useState(device?.deviceType || "");
  const [category, setCategory] = useState(device?.category || "");
  const [description, setDescription] = useState(device?.description || "");
  const [videoUrl, setVideoUrl] = useState(device?.videoUrl || "");
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [alarms, setAlarms] = useState(device?.alarms?.length ? device.alarms : [{ title: "", cause: "", fix: "" }]);
  const [quiz, setQuiz] = useState(
    device?.quiz?.length ? device.quiz.map((q) => ({ ...q, correctIndex: q.correctIndex ?? 0 })) : [{ question: "", options: ["", "", "", ""], correctIndex: 0 }]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateAlarm(i, field, val) { setAlarms((a) => a.map((x, idx) => (idx === i ? { ...x, [field]: val } : x))); }
  function updateQOption(qi, oi, val) { setQuiz((qs) => qs.map((q, idx) => (idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? val : o)) } : q))); }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const payload = {
        name, departmentId: departmentId || null, deviceType, category, description,
        videoUrl,
        alarms: alarms.filter((a) => a.title.trim()),
        quiz: quiz.filter((q) => q.question.trim()),
      };
      let saved;
      if (isEdit) {
        const { device: updated } = await api.put(`/devices/${device.id}`, payload);
        saved = updated;
      } else {
        const { device: created } = await api.post("/devices", payload);
        saved = created;
      }
      if (videoFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("video", videoFile);
        await api.postForm(`/devices/${saved.id}/video`, fd);
        setUploading(false);
      }
      onSaved(saved);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(lang === "ar" ? "حذف هذا الجهاز نهائياً؟" : "Delete this device permanently?")) return;
    await api.del(`/devices/${device.id}`);
    onDeleted?.();
  }

  const tabs = [["basic", t("common_description")], ["alarms", t("tab_alarms")], ["quiz", t("tab_quiz")]];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card w-full max-w-2xl p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b b-border">
          <h3 className="font-head font-bold">{isEdit ? t("common_edit") : t("devices_add")}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="flex gap-1 px-5 pt-3">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === k ? "text-white" : "txt-muted"}`} style={tab === k ? { background: "var(--teal)" } : {}}>{label}</button>
          ))}
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {tab === "basic" && (
            <div className="space-y-4">
              <div>
                <label className="field-label">{t("common_name")}</label>
                <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dental X-Ray Unit" />
              </div>
              <div>
                <label className="field-label">{t("common_department")}</label>
                <select className="field-input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">{t("field_device_type")}</label>
                  <input className="field-input" list="device-type-list" value={deviceType} onChange={(e) => setDeviceType(e.target.value)} placeholder={lang === "ar" ? "مثال: جهاز مراقبة" : "e.g. Patient Monitor"} />
                  <datalist id="device-type-list">
                    <option value="Patient Monitor" /><option value="X-Ray Unit" /><option value="Ultrasound" /><option value="Ventilator" /><option value="Infusion Pump" /><option value="Laser System" /><option value="Defibrillator" />
                  </datalist>
                </div>
                <div>
                  <label className="field-label">{t("field_category")}</label>
                  <input className="field-input" list="device-category-list" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={lang === "ar" ? "مثال: تشخيصي" : "e.g. Diagnostic"} />
                  <datalist id="device-category-list">
                    <option value="Diagnostic" /><option value="Therapeutic" /><option value="Monitoring" /><option value="Surgical" /><option value="Imaging" /><option value="Laboratory" /><option value="Life Support" />
                  </datalist>
                </div>
              </div>
              <div>
                <label className="field-label">{t("common_description")}</label>
                <textarea className="field-input" rows="3" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="field-label">{t("video_upload")}</label>
                {device?.videoAssetPath && !videoFile ? (
                  <div className="flex items-center gap-2 surface2 rounded-lg p-2 text-xs">
                    <Icon name="video" size={14} />{lang === "ar" ? "يوجد فيديو مرفوع" : "A video is already uploaded"}
                  </div>
                ) : (
                  <input type="file" accept="video/*" className="field-input" disabled={uploading} onChange={(e) => setVideoFile(e.target.files[0])} />
                )}
                {uploading && <div className="text-xs txt-muted mt-1">{t("video_uploading")}</div>}
              </div>
              <div className="text-[11px] txt-muted">{t("video_or")}</div>
              <div>
                <label className="field-label">YouTube URL ({lang === "ar" ? "اختياري" : "optional"})</label>
                <input className="field-input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
              </div>
            </div>
          )}
          {tab === "alarms" && (
            <div className="space-y-4">
              {alarms.map((a, i) => (
                <div key={i} className="surface2 rounded-xl p-3 space-y-2 relative">
                  <button className="icon-btn absolute top-2 end-2" onClick={() => setAlarms((arr) => arr.filter((_, idx) => idx !== i))}><Icon name="trash" size={14} /></button>
                  <input className="field-input" placeholder={lang === "ar" ? "اسم الإنذار" : "Alarm name"} value={a.title} onChange={(e) => updateAlarm(i, "title", e.target.value)} />
                  <textarea className="field-input" rows="2" placeholder={lang === "ar" ? "السبب المحتمل" : "Likely cause"} value={a.cause} onChange={(e) => updateAlarm(i, "cause", e.target.value)} />
                  <textarea className="field-input" rows="2" placeholder={lang === "ar" ? "الحل السريع" : "Fast resolution"} value={a.fix} onChange={(e) => updateAlarm(i, "fix", e.target.value)} />
                </div>
              ))}
              <button className="btn btn-outline btn-sm" onClick={() => setAlarms((a) => [...a, { title: "", cause: "", fix: "" }])}><Icon name="plus" size={14} />{lang === "ar" ? "إضافة إنذار" : "Add alarm"}</button>
            </div>
          )}
          {tab === "quiz" && (
            <div className="space-y-5">
              {quiz.map((q, qi) => (
                <div key={qi} className="surface2 rounded-xl p-3 space-y-2 relative">
                  <button className="icon-btn absolute top-2 end-2" onClick={() => setQuiz((arr) => arr.filter((_, idx) => idx !== qi))}><Icon name="trash" size={14} /></button>
                  <input className="field-input" placeholder={lang === "ar" ? "نص السؤال" : "Question text"} value={q.question} onChange={(e) => setQuiz((qs) => qs.map((x, idx) => (idx === qi ? { ...x, question: e.target.value } : x)))} />
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={"correct-" + qi} checked={q.correctIndex === oi} onChange={() => setQuiz((qs) => qs.map((x, idx) => (idx === qi ? { ...x, correctIndex: oi } : x)))} />
                      <input className="field-input" placeholder={(lang === "ar" ? "خيار " : "Option ") + (oi + 1)} value={o} onChange={(e) => updateQOption(qi, oi, e.target.value)} />
                    </div>
                  ))}
                </div>
              ))}
              <button className="btn btn-outline btn-sm" onClick={() => setQuiz((qs) => [...qs, { question: "", options: ["", "", "", ""], correctIndex: 0 }])}><Icon name="plus" size={14} />{lang === "ar" ? "إضافة سؤال" : "Add question"}</button>
            </div>
          )}
          {error && <div className="text-xs mt-3 rounded-lg p-2.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</div>}
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t b-border">
          {isEdit && can("devices.delete") ? (
            <button className="btn btn-danger btn-sm" onClick={del}><Icon name="trash" size={14} />{t("common_delete")}</button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost" onClick={onClose}>{t("common_cancel")}</button>
            <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>{busy ? t("common_loading") : t("common_save")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
