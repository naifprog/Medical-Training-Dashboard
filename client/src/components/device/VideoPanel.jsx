import { useEffect, useRef } from "react";
import Icon from "../Icon";
import { useUI } from "../../context/UIContext";
import { api } from "../../api/client";
import { youtubeEmbedUrl, fmtDate } from "../../utils/youtube";

export default function VideoPanel({ device, progress, onProgressChange }) {
  const { t, lang } = useUI();
  const videoRef = useRef(null);
  const maxPctRef = useRef(progress?.videoProgressPct || 0);
  const saveTimerRef = useRef(null);

  useEffect(() => { maxPctRef.current = progress?.videoProgressPct || 0; }, [device.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(ended) {
    const { progress: updated } = await api.post(`/progress/${device.id}/video`, { progressPct: maxPctRef.current, ended });
    onProgressChange(updated);
  }

  function onTimeUpdate(e) {
    const v = e.target;
    if (!v.duration) return;
    const pct = (v.currentTime / v.duration) * 100;
    if (pct > maxPctRef.current) maxPctRef.current = pct;
  }
  function onPlay() {
    if (saveTimerRef.current) return;
    saveTimerRef.current = setInterval(() => persist(false), 20000);
  }
  function stopTimer() {
    if (saveTimerRef.current) { clearInterval(saveTimerRef.current); saveTimerRef.current = null; }
  }
  async function onPause() { stopTimer(); await persist(false); }
  async function onEnded() { stopTimer(); maxPctRef.current = 100; await persist(true); }
  useEffect(() => () => stopTimer(), []);

  async function markWatched() {
    const { progress: updated } = await api.post(`/progress/${device.id}/video/mark-watched`);
    onProgressChange(updated);
  }

  const status = progress?.videoStatus || "not_started";
  const statusLabel = status === "completed" ? t("track_completed") : status === "in_progress" ? t("track_in_progress") : t("track_not_started");
  const statusColor = status === "completed" ? "var(--green)" : status === "in_progress" ? "var(--amber)" : "var(--text-muted)";
  const embedUrl = youtubeEmbedUrl(device.videoUrl);
  const searchUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(device.name + " official training tutorial");

  return (
    <div className="card p-5 space-y-4">
      {device.videoAssetPath ? (
        <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", background: "#000" }}>
          <video ref={videoRef} className="w-full h-full" controls src={device.videoAssetPath}
            onTimeUpdate={onTimeUpdate} onPlay={onPlay} onPause={onPause} onEnded={onEnded} />
        </div>
      ) : embedUrl ? (
        <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <iframe className="w-full h-full" src={embedUrl} title="training video" allowFullScreen />
        </div>
      ) : (
        <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 surface2 rounded-xl p-4 hover:opacity-90">
          <Icon name="video" size={20} />
          <div className="flex-1">
            <div className="text-sm font-semibold">{lang === "ar" ? "ابحث عن الفيديو الرسمي على يوتيوب" : "Search for official tutorial on YouTube"}</div>
            <div className="text-xs txt-muted mt-0.5">{device.name} — official training tutorial</div>
          </div>
          <Icon name="link" size={16} />
        </a>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="badge" style={{ background: "var(--surface-2)", color: statusColor }}>{statusLabel}</span>
        {progress?.videoProgressPct != null && device.videoAssetPath && <span className="txt-muted">{t("track_progress")}: {Math.round(progress.videoProgressPct)}%</span>}
        {progress?.videoViewCount ? <span className="txt-muted">{t("track_views")}: {progress.videoViewCount}</span> : null}
        {progress?.videoLastViewedAt ? <span className="txt-muted">{t("track_last_viewed")}: {fmtDate(progress.videoLastViewedAt, lang)}</span> : null}
      </div>

      {!device.videoAssetPath && (
        <button className="btn btn-sm" disabled={status === "completed"} onClick={markWatched} style={status === "completed" ? { background: "var(--green-bg)", color: "var(--green)" } : { background: "var(--teal)", color: "#fff" }}>
          <Icon name="check" size={14} />{status === "completed" ? t("video_watched") : t("video_watch")}
        </button>
      )}
    </div>
  );
}
