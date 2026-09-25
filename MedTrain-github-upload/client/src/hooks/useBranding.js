import { useEffect } from "react";
import { useFetch } from "./useFetch";
import { api } from "../api/client";

// Public endpoint (no login required) -- safe to call from the pre-login
// page as well as every authenticated role's header/sidebar. Company
// Settings dispatches "branding:changed" after a successful save/logo
// change so this refetches immediately instead of showing stale branding.
export function useBranding() {
  const { data, reload } = useFetch(() => api.get("/settings/branding"), []);

  useEffect(() => {
    function onChange() { reload(); }
    window.addEventListener("branding:changed", onChange);
    return () => window.removeEventListener("branding:changed", onChange);
  }, [reload]);

  return { name: data?.name || null, logoPath: data?.logoPath || null };
}
