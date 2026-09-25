import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "../components/Layout";
import { useUI } from "../context/UIContext";
import { api, ApiError } from "../api/client";

export default function ResetPassword() {
  const { t } = useUI();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) { setError(t("change_pw_mismatch")); return; }
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("reset_password_invalid"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex justify-center mb-4"><Logo size={48} /></div>
        <h1 className="font-head text-xl font-bold text-center mb-1">{t("reset_password_title")}</h1>
        {!token ? (
          <p className="text-sm text-center" style={{ color: "var(--red)" }}>{t("reset_password_invalid")}</p>
        ) : done ? (
          <>
            <p className="text-sm txt-muted text-center mb-6">{t("reset_password_success")}</p>
            <button className="btn btn-primary w-full justify-center" onClick={() => navigate("/login")}>{t("login_submit")}</button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="field-label">{t("reset_password_new")}</label>
              <input type="password" required minLength={8} autoFocus className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="field-label">{t("change_pw_confirm")}</label>
              <input type="password" required className="field-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <div className="text-xs rounded-lg p-2.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</div>}
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
              {busy ? t("common_loading") : t("reset_password_submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
