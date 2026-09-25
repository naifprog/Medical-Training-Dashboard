import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Layout";
import { useUI } from "../context/UIContext";
import { api } from "../api/client";

export default function ForgotPassword() {
  const { t } = useUI();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      // The API always returns the same response whether or not the email
      // exists -- there is intentionally nothing to branch on here.
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex justify-center mb-4"><Logo size={48} /></div>
        <h1 className="font-head text-xl font-bold text-center mb-1">{t("forgot_password_title")}</h1>
        {sent ? (
          <>
            <p className="text-sm txt-muted text-center mb-6">{t("forgot_password_sent")}</p>
            <Link to="/login" className="btn btn-outline w-full justify-center">{t("login_submit")}</Link>
          </>
        ) : (
          <>
            <p className="text-sm txt-muted text-center mb-6">{t("forgot_password_body")}</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="field-label">{t("login_email")}</label>
                <input type="email" required autoFocus className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@hospital.com" />
              </div>
              <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
                {busy ? t("common_loading") : t("forgot_password_submit")}
              </button>
              <Link to="/login" className="block text-center text-xs txt-muted font-semibold">{t("common_back")}</Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
