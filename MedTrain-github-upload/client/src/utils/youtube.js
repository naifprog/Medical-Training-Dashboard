export function youtubeEmbedUrl(urlOrId) {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  const id = match ? match[1] : /^[\w-]{6,}$/.test(trimmed) ? trimmed : null;
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function fmtDate(value, lang) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/**
 * For pure calendar dates (e.g. a "YYYY-MM-DD" due date) rather than
 * instants. Forces UTC so the same calendar day is shown to every viewer
 * regardless of their local timezone -- a due date must never appear to
 * shift by a day depending on where the browser happens to be.
 */
export function fmtDateOnly(value, lang) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}
