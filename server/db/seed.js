import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";
import { ROLE_SEED } from "../src/services/permissions.js";

const DEFAULT_DEPARTMENTS = ["ICU", "ER", "Dental", "Laser & Dermatology", "General Ward", "Radiology"];

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    for (const name of DEFAULT_DEPARTMENTS) {
      await client.query(
        `INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    }

    const roleIds = {};
    // System roles are source-controlled. Re-running the seed must repair
    // stale permissions after new capabilities are added in later releases.
    for (const [name, permissions] of Object.entries(ROLE_SEED)) {
      const res = await client.query(
        `INSERT INTO roles (name, permissions, is_system)
         VALUES ($1, $2, true)
         ON CONFLICT (name) DO UPDATE
         SET permissions = EXCLUDED.permissions, is_system = true
         RETURNING id`,
        [name, JSON.stringify(permissions)]
      );
      roleIds[name] = res.rows[0].id;
    }

    const userCount = await client.query("SELECT count(*)::int AS n FROM users");
    if (userCount.rows[0].n === 0) {
      const email = process.env.SEED_ADMIN_EMAIL || "admin@medtrain.local";
      const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
      const name = process.env.SEED_ADMIN_NAME || "System Administrator";
      const hash = await bcrypt.hash(password, 12);
      const dept = await client.query("SELECT id FROM departments ORDER BY name LIMIT 1");
      await client.query(
        `INSERT INTO users (full_name, email, password_hash, must_change_password, active, role_id, department_id)
         VALUES ($1, $2, $3, false, true, $4, $5)`,
        [name, email, hash, roleIds.Administrator, dept.rows[0].id]
      );
      console.log(`Seeded initial administrator: ${email} / ${password}`);
      console.log("Change this password after first login.");
    } else {
      console.log("Users already exist, skipping admin seed.");
    }

    console.log("Seed complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
