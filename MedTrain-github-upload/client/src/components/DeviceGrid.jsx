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
            className="card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex flex-col"
            onClick={() => navigate(`/devices/${d.id}`)}
          >
            {/* Fixed-ratio image area -- same footprint with or without an
                image, so the grid never looks inconsistent across cards. */}
            <div className="relative shrink-0" style={{ aspectRatio: "16 / 9" }}>
              {d.imagePath ? (
                <img src={d.imagePath} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--teal-soft)", color: "var(--teal-dark)" }}>
                  <Icon name="devices" size={36} />
                </div>
              )}
              {d.active === false && (
                <span className="badge badge-fail absolute top-2 end-2">{t("device_inactive")}</span>
              )}
            </div>

            <div className="p-4 flex flex-col gap-2 flex-1">
              <div>
                <div className="font-head font-semibold text-sm leading-snug">{d.name}</div>
                {d.model && <div className="text-[11px] txt-muted mt-0.5">{d.model}</div>}
              </div>
              {d.description && <div className="text-xs txt-muted line-clamp-2">{d.description}</div>}
              <div className="flex items-center gap-2 mt-auto pt-1 flex-wrap">
                {d.departmentName && <span className="badge badge-dept">{d.departmentName}</span>}
                {prog && prog.quizBestScore != null && (
                  prog.quizPassed
                    ? <span className="badge badge-pass"><Icon name="check" size={11} />{t("quiz_pass")}</span>
                    : <span className="badge badge-fail">{t("quiz_fail")}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
