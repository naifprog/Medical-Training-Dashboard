import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "../components/Layout";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export default function ChangePassword({ forced }) {
  const { t } = useUI();
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError(t("change_pw_mismatch"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePassword(currentPassword, newPassword);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex justify-center mb-4"><Logo size={48} /></div>
        <h1 className="font-head text-xl font-bold text-center mb-1">{t("change_pw_title")}</h1>
        <p className="text-sm txt-muted text-center mb-6">
          {forced || user?.mustChangePassword ? t("change_pw_body") : ""}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="field-label">{t("change_pw_current")}</label>
            <input type="password" required autoFocus className="field-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t("change_pw_new")}</label>
            <input type="password" required minLength={8} className="field-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t("change_pw_confirm")}</label>
            <input type="password" required className="field-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <div className="text-xs rounded-lg p-2.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</div>}
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? t("common_loading") : t("change_pw_submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
