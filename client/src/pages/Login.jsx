import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { BrandLogo } from "../components/Layout";
import Icon from "../components/Icon";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../hooks/useBranding";
import { ApiError } from "../api/client";

export default function Login() {
  const { t, lang, toggleLang } = useUI();
  const { login } = useAuth();
  const { name: companyName, logoPath } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(email.trim(), password);
      const dest = location.state?.from || (user.mustChangePassword ? "/change-password" : "/");
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative">
      <button className="icon-btn absolute top-4 end-4" onClick={toggleLang}><Icon name="globe" size={16} /></button>
      <div className="card p-8 w-full max-w-sm">
        <div className="flex justify-center mb-4"><BrandLogo size={48} logoPath={logoPath} /></div>
        <h1 className="font-head text-xl font-bold text-center mb-1">{t("login_title")}</h1>
        <p className="text-sm txt-muted text-center mb-6">{companyName || t("tagline")}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="field-label">{t("login_email")}</label>
            <input
              type="email" required autoFocus className="field-input"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@hospital.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="field-label">{t("login_password")}</label>
              <Link to="/forgot-password" className="text-[11px] font-semibold" style={{ color: "var(--teal-dark)" }}>{t("login_forgot_password")}</Link>
            </div>
            <input
              type="password" required className="field-input"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="text-xs rounded-lg p-2.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</div>
          )}
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? t("common_loading") : t("login_submit")}
            <Icon name={lang === "ar" ? "chevronLeft" : "chevronRight"} size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
