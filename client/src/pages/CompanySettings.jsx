import { useEffect, useState } from "react";
import { useUI } from "../context/UIContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import Icon from "../components/Icon";

export default function CompanySettings() {
  const { t } = useUI();
  const { data, reload } = useFetch(() => api.get("/settings/company"), []);
  const [name, setName] = useState("");
  const [cr, setCr] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [saved, setSaved] = useState(false);

  const settings = data?.settings;
  useEffect(() => {
    if (settings) {
      setName(settings.name || "");
      setCr(settings.commercialRegistration || "");
    }
  }, [settings]);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await api.put("/settings/company", { name, commercialRegistration: cr });
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await api.postForm("/settings/company/logo", fd);
        setLogoFile(null);
      }
      await reload();
      window.dispatchEvent(new Event("branding:changed"));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  async function removeLogo() {
    setRemovingLogo(true);
    try {
      await api.del("/settings/company/logo");
      await reload();
      window.dispatchEvent(new Event("branding:changed"));
    } finally {
      setRemovingLogo(false);
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-head text-2xl font-bold mb-6">{t("settings_title")}</h1>
      <div className="card p-5 space-y-4">
        <div>
          <label className="field-label">{t("settings_company_name")}</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label">{t("settings_cr_number")}</label>
          <input className="field-input" value={cr} onChange={(e) => setCr(e.target.value)} />
        </div>
        <div>
          <label className="field-label">{t("settings_logo")}</label>
          <div className="flex items-center gap-3 mb-2">
            {settings?.logoPath && !logoFile ? (
              <img src={settings.logoPath} alt="" className="w-14 h-14 rounded-lg object-contain surface2" />
            ) : (
              <div className="w-14 h-14 rounded-lg flex items-center justify-center surface2" style={{ color: "var(--text-muted)" }}>
                <Icon name="building" size={22} />
              </div>
            )}
            {settings?.logoPath && !logoFile && (
              <button className="btn btn-outline btn-sm" disabled={removingLogo} onClick={removeLogo}>
                <Icon name="trash" size={13} />{removingLogo ? t("common_loading") : t("common_remove")}
              </button>
            )}
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="field-input" onChange={(e) => setLogoFile(e.target.files[0])} />
        </div>
        {saved && (
          <div className="text-xs rounded-lg p-2.5" style={{ background: "var(--green-bg)", color: "var(--green)" }}>{t("settings_saved")}</div>
        )}
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          <Icon name="check" size={14} />{busy ? t("common_loading") : t("common_save")}
        </button>
      </div>
    </div>
  );
}
