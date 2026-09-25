import Icon from "../Icon";
import { useUI } from "../../context/UIContext";
import { fmtDate } from "../../utils/youtube";

export default function Certificate({ user, device, progress, onClose }) {
  const { t, lang } = useUI();
  const date = fmtDate(progress?.quizPassedAt || Date.now(), lang);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-2 mb-3 no-print">
          <button className="btn btn-outline btn-sm" style={{ background: "var(--surface)" }} onClick={() => window.print()}><Icon name="printer" size={14} />{t("common_print")}</button>
          <button className="btn btn-ghost btn-sm" style={{ background: "var(--surface)" }} onClick={onClose}><Icon name="x" size={14} />{t("common_close")}</button>
        </div>
        <div className="certificate-sheet card p-10 text-center" style={{ background: "#fff", color: "#0B2545" }}>
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#0F766E" }}>
              <Icon name="stethoscope" size={28} className="text-white" />
            </div>
          </div>
          <div className="text-[11px] tracking-[.2em] font-bold uppercase mb-6" style={{ color: "#0F766E" }}>MedTrain</div>
          <h1 className="font-head text-2xl font-bold mb-6">{t("cert_title")}</h1>
          <p className="text-sm mb-1" style={{ color: "#57697C" }}>{t("cert_certifies")}</p>
          <p className="font-head text-3xl font-bold my-3" style={{ color: "#0B2545" }}>{user.fullName}</p>
          <p className="text-sm mb-1" style={{ color: "#57697C" }}>{t("cert_completed")}</p>
          <p className="font-head text-xl font-semibold mb-6">{device.name}</p>
          <div className="flex justify-center gap-10 text-xs mt-8 pt-6" style={{ borderTop: "1px solid #DCE6E4", color: "#57697C" }}>
            <div><div className="font-bold mb-0.5">{lang === "ar" ? "التاريخ" : "Date"}</div>{date}</div>
            <div><div className="font-bold mb-0.5">{lang === "ar" ? "النتيجة" : "Score"}</div>{progress?.quizBestScore ?? progress?.quizLastScore ?? "—"}%</div>
            <div><div className="font-bold mb-0.5">{lang === "ar" ? "القسم" : "Department"}</div>{user.departmentName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
