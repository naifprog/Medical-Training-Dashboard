import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { useUI } from "../context/UIContext";

export default function DeviceGrid({ devices, progress }) {
  const { t } = useUI();
  const navigate = useNavigate();

  if (devices === null) return <div className="txt-muted text-sm py-10 text-center">{t("common_loading")}</div>;
  if (devices.length === 0) return <div className="txt-muted text-sm py-10 text-center card">{t("devices_empty")}</div>;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {devices.map((d) => {
        const prog = (progress || []).find((p) => p.deviceId === d.id);
        return (
          <div
            key={d.id}
            className="card p-4 cursor-pointer hover:shadow-lg transition-shadow flex flex-col gap-3"
            onClick={() => navigate(`/devices/${d.id}`)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--teal-soft)", color: "var(--teal-dark)" }}>
                <Icon name="devices" size={19} />
              </div>
              {prog && prog.quizBestScore != null && (
                prog.quizPassed
                  ? <span className="badge badge-pass"><Icon name="check" size={12} />{t("quiz_pass")}</span>
                  : <span className="badge badge-fail">{t("quiz_fail")}</span>
              )}
            </div>
            <div>
              <div className="font-head font-semibold text-sm leading-snug">{d.name}</div>
              {d.deviceType && <div className="text-[11px] txt-muted mt-0.5">{d.deviceType}</div>}
              <div className="text-xs txt-muted mt-1 line-clamp-2">{d.description}</div>
            </div>
            <div className="flex items-center gap-2 mt-auto pt-1 flex-wrap">
              {d.departmentName && <span className="badge badge-dept">{d.departmentName}</span>}
              {d.category && <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{d.category}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
