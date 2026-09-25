export default function Icon({ name, size = 20, className = "", strokeWidth = 1.8 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", className };
  switch (name) {
    case "home": return <svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></svg>;
    case "devices": return <svg {...p}><rect x="3" y="3" width="8" height="8" rx="1.6" /><rect x="13" y="3" width="8" height="8" rx="1.6" /><rect x="3" y="13" width="8" height="8" rx="1.6" /><rect x="13" y="13" width="8" height="8" rx="1.6" /></svg>;
    case "users": return <svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17.3" cy="8.6" r="2.5" /><path d="M15.6 14.2c2.6.5 4.2 2.6 4.2 5.8" /></svg>;
    case "chart": return <svg {...p}><path d="M4 20V10" /><path d="M11 20V4" /><path d="M18 20v-7" /><path d="M2.5 20h19" /></svg>;
    case "qr": return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="3" height="3" /><path d="M20 14v3" /><path d="M14 20h3" /><path d="M20 20h.01" /></svg>;
    case "video": return <svg {...p}><rect x="2.5" y="5.5" width="13" height="13" rx="2.2" /><path d="M15.5 10.2 21 7v10l-5.5-3.2" /></svg>;
    case "alert": return <svg {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>;
    case "check": return <svg {...p}><path d="M4 12.5 9.5 18 20 6" /></svg>;
    case "plus": return <svg {...p}><path d="M12 4v16" /><path d="M4 12h16" /></svg>;
    case "edit": return <svg {...p}><path d="M4 20h4L19.4 8.6a2.1 2.1 0 0 0-3-3L4.5 17.1Z" /><path d="M14 6.5 17.5 10" /></svg>;
    case "trash": return <svg {...p}><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6 7l1 13h10l1-13" /></svg>;
    case "download": return <svg {...p}><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 20h16" /></svg>;
    case "printer": return <svg {...p}><path d="M6 9V4h12v5" /><rect x="4" y="9" width="16" height="7" rx="1.6" /><path d="M6 15h12v6H6z" /></svg>;
    case "x": return <svg {...p}><path d="M5 5l14 14" /><path d="M19 5 5 19" /></svg>;
    case "chevronRight": return <svg {...p}><path d="M9 5l7 7-7 7" /></svg>;
    case "chevronLeft": return <svg {...p}><path d="M15 5l-7 7 7 7" /></svg>;
    case "activity": return <svg {...p}><path d="M2 12h4l2-7 4 14 2-7h8" /></svg>;
    case "shield": return <svg {...p}><path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3Z" /></svg>;
    case "search": return <svg {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.5-4.5" /></svg>;
    case "sun": return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>;
    case "moon": return <svg {...p}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" /></svg>;
    case "globe": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.5 3.8 5.8 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.8-3.8-9S9.5 5.5 12 3Z" /></svg>;
    case "stethoscope": return <svg {...p}><path d="M5 4v5a4 4 0 0 0 8 0V4" /><path d="M9 13v2a5 5 0 0 0 10 0v-2.5" /><circle cx="19" cy="9.5" r="1.6" /></svg>;
    case "building": return <svg {...p}><rect x="4" y="3" width="16" height="18" rx="1.2" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /></svg>;
    case "award": return <svg {...p}><circle cx="12" cy="9" r="5.5" /><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" /></svg>;
    case "cap": return <svg {...p}><path d="M2 9l10-4 10 4-10 4-10-4Z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></svg>;
    case "rotate": return <svg {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" /></svg>;
    case "upload": return <svg {...p}><path d="M12 20V8" /><path d="M7 13l5-5 5 5" /><path d="M4 20h16" /></svg>;
    case "lock": return <svg {...p}><rect x="5" y="10.5" width="14" height="9" rx="1.6" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>;
    case "link": return <svg {...p}><path d="M9 15l6-6" /><path d="M8 13 5.5 15.5a3.4 3.4 0 0 0 4.8 4.8L13 17.8" /><path d="M16 11l2.5-2.5a3.4 3.4 0 0 0-4.8-4.8L11.3 6.3" /></svg>;
    case "clock": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case "logout": return <svg {...p}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="M15 16l5-4-5-4" /><path d="M20 12H9" /></svg>;
    case "menu": return <svg {...p}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>;
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>;
  }
}
