import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useUI } from "./context/UIContext";
import AppShell from "./components/Layout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Activate from "./pages/Activate";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import DeviceDetail from "./pages/DeviceDetail";
import Departments from "./pages/Departments";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import Reports from "./pages/Reports";
import MyTrainees from "./pages/MyTrainees";
import TraineeProfile from "./pages/TraineeProfile";
import CompanySettings from "./pages/CompanySettings";
import DevSwitcher from "./components/DevSwitcher";

function FullScreenLoading() {
  const { t } = useUI();
  return <div className="min-h-screen flex items-center justify-center txt-muted text-sm">{t("common_loading")}</div>;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <AppShell>{children}</AppShell>;
}

function RequirePermission({ perm, children }) {
  const { can } = useAuth();
  if (!can(perm)) return <Navigate to="/" replace />;
  return children;
}

// Shown in real local dev (import.meta.env.DEV) OR in a build explicitly
// compiled with `vite build --mode demo` (VITE_ENABLE_DEV_SWITCHER=true,
// see client/.env.demo). A plain `npm run build` / `vite build` (the
// default "production" mode) never sets this, so DevSwitcher is excluded
// from a real production build by default -- no code change needed to
// remove it before a real deployment, just don't build in demo mode.
const SHOW_DEV_SWITCHER = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_SWITCHER === "true";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoading />;

  return (
    <>
      {SHOW_DEV_SWITCHER && <DevSwitcher />}
      <Routes>
      <Route path="/login" element={user && !user.mustChangePassword ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/activate" element={<Activate />} />
      <Route
        path="/change-password"
        element={user ? <ChangePassword forced={user.mustChangePassword} /> : <Navigate to="/login" replace />}
      />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route
        path="/devices"
        element={<RequireAuth><RequirePermission perm="devices.view"><Devices /></RequirePermission></RequireAuth>}
      />
      <Route
        path="/devices/:id"
        element={<RequireAuth><RequirePermission perm="devices.view"><DeviceDetail /></RequirePermission></RequireAuth>}
      />
      <Route
        path="/departments"
        element={<RequireAuth><Departments /></RequireAuth>}
      />
      <Route
        path="/users"
        element={<RequireAuth><RequirePermission perm="users.view"><Users /></RequirePermission></RequireAuth>}
      />
      <Route
        path="/trainees"
        element={<RequireAuth><RequirePermission perm="trainees.view"><MyTrainees /></RequirePermission></RequireAuth>}
      />
      <Route
        path="/trainees/:id"
        element={<RequireAuth><RequirePermission perm="trainees.view"><TraineeProfile /></RequirePermission></RequireAuth>}
      />
      <Route
        path="/roles"
        element={<RequireAuth><Roles /></RequireAuth>}
      />
      <Route
        path="/reports"
        element={<RequireAuth><RequirePermission perm="reports.view"><Reports /></RequirePermission></RequireAuth>}
      />
      <Route
        path="/settings"
        element={<RequireAuth><RequirePermission perm="settings.manage"><CompanySettings /></RequirePermission></RequireAuth>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
