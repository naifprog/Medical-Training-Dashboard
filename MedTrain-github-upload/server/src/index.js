import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";

import { pool } from "./db.js";
import { loadUser } from "./middleware/auth.js";

// Defense in depth: an unguarded async error anywhere in the app (a bug we
// just found and fixed in the PDF/Excel export path) must never be able to
// crash the whole server for every user. Node terminates the process by
// default on an unhandled rejection -- log it instead and keep serving.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (server kept running):", reason);
});

import authRoutes from "./routes/auth.js";
import departmentRoutes from "./routes/departments.js";
import roleRoutes from "./routes/roles.js";
import userRoutes from "./routes/users.js";
import deviceRoutes from "./routes/devices.js";
import assignmentRoutes from "./routes/assignments.js";
import progressRoutes from "./routes/progress.js";
import reportRoutes from "./routes/reports.js";
import settingsRoutes from "./routes/settings.js";
import auditRoutes from "./routes/audit.js";

const app = express();
const PgSession = connectPgSimple(session);

const isProd = process.env.NODE_ENV === "production";
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim());

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan(isProd ? "combined" : "dev"));
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.use(
  session({
    name: "medtrain.sid",
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: false }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12, // 12 hours
    },
  })
);

app.use(loadUser);

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);

// Every other API route is blocked until a pending forced password change is completed.
app.use("/api", (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ error: "Password change required", code: "MUST_CHANGE_PASSWORD" });
  }
  next();
});
app.use("/api/departments", departmentRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/audit", auditRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.message && /Only video files|Only JPEG, PNG, or WEBP/.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File is too large." });
  }
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`MedTrain API listening on port ${port}`);
});
