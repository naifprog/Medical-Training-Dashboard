import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Icon from "../Icon";
import { useUI } from "../../context/UIContext";

export default function QrPanel({ device }) {
  const { t } = useUI();
  const canvasRef = useRef(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const link = `${location.origin}/devices/${device.id}`;
    setUrl(link);
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, link, { width: 220, margin: 1, color: { dark: "#0B2545", light: "#FFFFFF" } }, () => {});
    }
  }, [device.id]);

  function download() {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.download = device.name.replace(/[^a-z0-9]+/gi, "-") + "-qr.png";
    a.href = canvasRef.current.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="card p-6 flex flex-col items-center text-center gap-4">
      <div className="qr-canvas-wrap"><canvas ref={canvasRef} /></div>
      <p className="text-xs txt-muted max-w-xs">{t("scan_hint")}</p>
      <div className="text-[11px] font-mono txt-muted break-all max-w-sm">{url}</div>
      <button className="btn btn-outline btn-sm" onClick={download}><Icon name="download" size={14} />{t("common_download")}</button>
    </div>
  );
}
