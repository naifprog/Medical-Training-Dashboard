import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";

export function Logo({ size = 30 }) {
  return (
    <div className="flex items-center justify-center rounded-xl" style={{ width: size, height: size, background: "var(--teal)" }}>
      <Icon name="stethoscope" size={size * 0.6} className="text-white" strokeWidth={2} />
    </div>
  );
}

function TopBar({ onMenu }) {
  const { t, lang, toggleLang, theme, toggleTheme } = useUI();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function doLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 h-16 border-b b-border" style={{ background: "var(--surface)" }}>
      <button className="icon-btn md:hidden" onClick={onMenu} aria-label="menu">
        <Icon name="devices" size={18} />
      </button>
      <div className="flex items-center gap-2.5">
        <Logo size={32} />
        <div className="leading-tight">
          <div className="font-head font-bold text-sm">{t("appName")}</div>
          <div className="text-[11px] txt-muted hidden sm:block">{t("tagline")}</div>
        </div>
      </div>
      <div className="flex-1" />
      <button className="icon-btn" title="Toggle language" onClick={toggleLang}>
        <Icon name="globe" size={17} />
      </button>
      <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
      </button>
      {user && (
        <div className="flex items-center gap-2 pl-2 ms-1 border-s b-border">
          <div className="w-8 h-8 rounded-full surface2 flex items-center justify-center text-xs font-bold">{(user.fullName || "?").slice(0, 1)}</div>
          <div className="hidden sm:block leading-tight">
            <div className="text-xs font-semibold">{user.fullName}</div>
            <div className="text-[10px] txt-muted">{user.roleName}</div>
          </div>
          <button className="icon-btn" title={t("common_logout")} onClick={doLogout}>
            <Icon name="logout" size={16} />
          </button>
        </div>
      )}
    </header>
  );
}

function Sidebar({ className }) {
  const { t, lang } = useUI();
  const { user, can } = useAuth();

  const items = [
    { to: "/", label: t("nav_dashboard"), icon: "home", show: true, end: true },
    { to: "/devices", label: t("nav_devices"), icon: "devices", show: can("devices.view") },
    { to: "/departments", label: t("nav_departments"), icon: "building", show: can("devices.create") || can("devices.edit") },
    { to: "/users", label: t("nav_users"), icon: "users", show: can("users.view") },
    { to: "/roles", label: t("nav_roles"), icon: "shield", show: can("users.rolesCreate") || can("users.rolesEdit") || can("users.rolesDelete") },
    { to: "/reports", label: t("nav_reports"), icon: "chart", show: can("reports.view") },
    { to: "/report", label: t("nav_report"), icon: "printer", show: can("reports.view") },
  ];

  return (
    <nav className={`w-64 shrink-0 p-4 flex flex-col gap-1 border-e b-border ${className || ""}`} style={{ background: "var(--surface)" }}>
      {items.filter((i) => i.show).map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className={({ isActive }) => `navitem ${isActive ? "active" : ""}`}
        >
          <Icon name={i.icon} size={18} />{i.label}
        </NavLink>
      ))}
      <div className="flex-1" />
      {user && (
        <div className="card p-3 text-[11px] txt-muted leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold mb-1" style={{ color: "var(--teal-dark)" }}>
            <Icon name="shield" size={14} />{user.roleName}
          </div>
          {user.departmentName}
        </div>
      )}
    </nav>
  );
}

export default function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onMenu={() => setMobileOpen((v) => !v)} />
      <div className="flex flex-1 min-h-0">
        <Sidebar className="hidden md:flex" />
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0" style={{ background: "rgba(6,14,24,.55)" }} />
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <Sidebar className="flex h-full" />
            </div>
          </div>
        )}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
