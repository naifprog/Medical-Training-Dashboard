import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.resolve(__dirname, "../../assets/fonts");

function fontDataUri(filename) {
  const buf = fs.readFileSync(path.join(fontsDir, filename));
  return `data:font/ttf;base64,${buf.toString("base64")}`;
}

let cachedFontFaces = null;
function fontFacesCss() {
  if (cachedFontFaces) return cachedFontFaces;
  cachedFontFaces = `
    @font-face { font-family: 'DejaVu Sans'; src: url(${fontDataUri("DejaVuSans.ttf")}) format('truetype'); font-weight: 400; }
    @font-face { font-family: 'DejaVu Sans'; src: url(${fontDataUri("DejaVuSans-Bold.ttf")}) format('truetype'); font-weight: 700; }
    @font-face { font-family: 'Amiri'; src: url(${fontDataUri("Amiri-Regular.ttf")}) format('truetype'); font-weight: 400; }
    @font-face { font-family: 'Amiri'; src: url(${fontDataUri("Amiri-Bold.ttf")}) format('truetype'); font-weight: 700; }
  `;
  return cachedFontFaces;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/**
 * Renders a titled table report to a PDF buffer using headless Chromium.
 * Rendering through a real browser (rather than a client-side PDF library)
 * gives correct Arabic shaping/bidi ordering for free.
 */
export async function renderTablePdf({ title, subtitle, lang = "en", columns, rows, generatedAt, totalLabel, companyHeader }) {
  const isRtl = lang === "ar";
  const dir = isRtl ? "rtl" : "ltr";
  const fontFamily = isRtl ? "'Amiri', 'DejaVu Sans', sans-serif" : "'DejaVu Sans', sans-serif";

  const headCells = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const bodyRows = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(row[c.key])}</td>`).join("")}</tr>`)
    .join("");

  // Company header is entirely optional -- any missing field is simply
  // omitted rather than rendering an empty placeholder. Populated once
  // Company Settings exists; safe/no-op until then.
  const hasCompanyHeader = companyHeader && (companyHeader.logoDataUri || companyHeader.name || companyHeader.commercialRegistration);
  const companyHeaderHtml = hasCompanyHeader
    ? `<div class="company-header">
        ${companyHeader.logoDataUri ? `<img src="${companyHeader.logoDataUri}" class="company-logo" />` : ""}
        <div>
          ${companyHeader.name ? `<div class="company-name">${escapeHtml(companyHeader.name)}</div>` : ""}
          ${companyHeader.commercialRegistration ? `<div class="company-cr">${escapeHtml(companyHeader.commercialRegistration)}</div>` : ""}
        </div>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<style>
  ${fontFacesCss()}
  * { box-sizing: border-box; }
  body { font-family: ${fontFamily}; color: #0B2545; margin: 0; padding: 28px 34px; }
  .company-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .company-logo { width: 36px; height: 36px; object-fit: contain; }
  .company-name { font-size: 13px; font-weight: 700; }
  .company-cr { font-size: 9px; color: #57697C; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .subtitle { font-size: 11px; color: #57697C; margin: 0 0 4px; }
  .meta { font-size: 10px; color: #57697C; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th, td { border: 1px solid #DCE6E4; padding: 6px 8px; text-align: ${isRtl ? "right" : "left"}; }
  th { background: #EEF4F3; color: #0B5A54; font-weight: 700; }
  tr:nth-child(even) td { background: #FAFDFC; }
  tfoot td { font-weight: 700; background: #EEF4F3; }
</style>
</head>
<body>
  ${companyHeaderHtml}
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
  <div class="meta">${escapeHtml(generatedAt)}</div>
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows || `<tr><td colspan="${columns.length}" style="text-align:center;color:#57697C;">—</td></tr>`}</tbody>
    ${totalLabel ? `<tfoot><tr><td colspan="${columns.length}">${escapeHtml(totalLabel)}</td></tr></tfoot>` : ""}
  </table>
</body>
</html>`;

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
      printBackground: true,
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
