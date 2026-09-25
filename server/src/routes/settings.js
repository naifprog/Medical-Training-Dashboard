import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { query } from "../db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { getCompanySettings } from "../services/companySettings.js";
import { recordAudit } from "../services/audit.js";

const router = express.Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadLogo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname) || ""}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) return cb(new Error("Only JPEG, PNG, or WEBP images are allowed."));
    cb(null, true);
  },
});

router.get("/company", requireAuth, requirePermission("settings.manage"), async (req, res) => {
  res.json({ settings: await getCompanySettings() });
});

// Public branding subset (name + logo only, never commercialRegistration) --
// deliberately no requireAuth/permission check. Used by the pre-login page
// and by every authenticated role's header/sidebar, none of which should
// need settings.manage just to see the organization's own logo.
router.get("/branding", async (req, res) => {
  const settings = await getCompanySettings();
  res.json({ name: settings.name, logoPath: settings.logoPath });
});

router.put("/company", requireAuth, requirePermission("settings.manage"), async (req, res) => {
  const { name, commercialRegistration } = req.body || {};
  await query(
    "UPDATE company_settings SET name = $1, commercial_registration = $2, updated_at = now() WHERE id = 1",
    [name?.trim() || null, commercialRegistration?.trim() || null]
  );
  await recordAudit(req.user.id, "company_settings.changed", "company_settings", null, {});
  res.json({ settings: await getCompanySettings() });
});

router.post("/company/logo", requireAuth, requirePermission("settings.manage"), uploadLogo.single("logo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No logo file uploaded." });
  const existing = await getCompanySettings();
  const newPath = `/uploads/${req.file.filename}`;
  await query("UPDATE company_settings SET logo_path = $1, updated_at = now() WHERE id = 1", [newPath]);
  if (existing.logoPath && existing.logoPath !== newPath) {
    fs.unlink(path.join(uploadDir, path.basename(existing.logoPath)), () => {});
  }
  res.json({ settings: await getCompanySettings() });
});

router.delete("/company/logo", requireAuth, requirePermission("settings.manage"), async (req, res) => {
  const existing = await getCompanySettings();
  await query("UPDATE company_settings SET logo_path = NULL, updated_at = now() WHERE id = 1");
  if (existing.logoPath) {
    fs.unlink(path.join(uploadDir, path.basename(existing.logoPath)), () => {});
  }
  await recordAudit(req.user.id, "company_settings.logo_removed", "company_settings", null, {});
  res.json({ settings: await getCompanySettings() });
});

export default router;
