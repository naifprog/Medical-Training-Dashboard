import { createContext, useContext, useEffect, useState } from "react";
import { useT } from "../i18n/strings";

const UIContext = createContext(null);

function safeGet(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function UIProvider({ children }) {
  const [lang, setLang] = useState(() => safeGet("medtrain.lang", "en"));
  const [theme, setTheme] = useState(() => safeGet("medtrain.theme", "system"));

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem("medtrain.lang", lang); } catch { /* ignore */ }
  }, [lang]);

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    try { localStorage.setItem("medtrain.theme", theme); } catch { /* ignore */ }
  }, [theme]);

  const t = useT(lang);
  const toggleLang = () => setLang((l) => (l === "en" ? "ar" : "en"));
  const toggleTheme = () => setTheme((th) => (th === "dark" ? "light" : "dark"));

  return (
    <UIContext.Provider value={{ lang, setLang, toggleLang, theme, setTheme, toggleTheme, t }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
