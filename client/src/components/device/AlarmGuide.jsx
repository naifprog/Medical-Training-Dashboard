import { useState } from "react";
import Icon from "../Icon";
import { useUI } from "../../context/UIContext";

function FlipCard({ alarm }) {
  const { lang } = useUI();
  const [flip, setFlip] = useState(false);
  return (
    <div className={`flip-card ${flip ? "flipped" : ""}`} onClick={() => setFlip((f) => !f)}>
      <div className="flip-inner">
        <div className="flip-face flip-front">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--red-bg)", color: "var(--red)" }}><Icon name="alert" size={17} /></div>
          <div className="font-head font-semibold text-sm">{alarm.title}</div>
          <div className="text-xs txt-muted mt-auto pt-3">{lang === "ar" ? "اضغط لعرض السبب والحل" : "Tap to reveal cause & fix"}</div>
        </div>
        <div className="flip-face flip-back">
          <div className="text-[10px] font-bold uppercase tracking-wide opacity-80 mb-1">Cause</div>
          <div className="text-xs leading-relaxed mb-2">{alarm.cause}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide opacity-80 mb-1">Fix</div>
          <div className="text-xs leading-relaxed">{alarm.fix}</div>
        </div>
      </div>
    </div>
  );
}

export default function AlarmGuide({ alarms }) {
  const { t } = useUI();
  if (!alarms?.length) return <div className="card p-6 text-sm txt-muted text-center">{t("common_none")}</div>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {alarms.map((a, i) => <FlipCard key={i} alarm={a} />)}
    </div>
  );
}
