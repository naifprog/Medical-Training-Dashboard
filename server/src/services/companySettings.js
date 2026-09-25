import fs from "node:fs";
import path from "node:path";
import { query } from "../db.js";

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");

/** Row shape for the settings API (camelCase, no file I/O). */
export async function getCompanySettings() {
  const result = await query("SELECT name, commercial_registration, logo_path FROM company_settings WHERE id = 1");
  const row = result.rows[0] || {};
  return { name: row.name || null, commercialRegistration: row.commercial_registration || null, logoPath: row.logo_path || null };
}

/** For PDF headers: converts the logo file (if any) to a data URI; any missing field is simply omitted. */
export async function getCompanyHeaderForPdf() {
  const settings = await getCompanySettings();
  let logoDataUri = null;
  if (settings.logoPath) {
    try {
      const filePath = path.join(uploadDir, path.basename(settings.logoPath));
      const ext = path.extname(filePath).replace(".", "") || "png";
      logoDataUri = `data:image/${ext};base64,${fs.readFileSync(filePath).toString("base64")}`;
    } catch {
      logoDataUri = null; // missing/unreadable file -> header just omits the logo
    }
  }
  return { name: settings.name, commercialRegistration: settings.commercialRegistration, logoDataUri };
}
