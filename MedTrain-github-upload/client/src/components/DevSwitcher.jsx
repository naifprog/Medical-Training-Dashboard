import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { DEV_TEST_ACCOUNTS } from "../devTestAccounts";

// Dev-only helper to jump between the three real test accounts (seeded via
// `npm run seed:test` in server/) without typing credentials each time.
// It performs a REAL login through AuthContext.login() -> POST /api/auth/login
// -> a real server session, exactly like the Login page. It never mutates
// `user` in React directly. Rendered only when import.meta.env.DEV is true
// (see App.jsx), so it is dead-code-eliminated from production builds.
export default function DevSwitcher() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [busyEmail, setBusyEmail] = useState(null);
  const [error, setError] = useState("");

  async function switchTo(account) {
    setBusyEmail(account.email);
    setError("");
    try {
      await login(account.email, account.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${account.role}: ${err.message}`
          : `${account.role}: switch failed`
      );
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div
      className="card fixed bottom-4 start-4 z-50 p-3 text-xs"
      style={{ width: 220 }}
    >
      <div className="font-head font-bold mb-2 flex items-center gap-1.5">
        🧪 Dev Switcher
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: "var(--red-bg)", color: "var(--red)" }}
        >
          DEMO
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {DEV_TEST_ACCOUNTS.map((account) => {
          const isCurrent = user?.email === account.email;
          return (
            <button
              key={account.email}
              className={`btn btn-sm justify-start ${isCurrent ? "btn-primary" : "btn-outline"}`}
              disabled={busyEmail !== null}
              onClick={() => switchTo(account)}
            >
              {busyEmail === account.email ? "…" : isCurrent ? "●" : "○"} {account.role}
            </button>
          );
        })}
      </div>
      {error && (
        <div
          className="text-[11px] rounded-lg p-2 mt-2"
          style={{ background: "var(--red-bg)", color: "var(--red)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
