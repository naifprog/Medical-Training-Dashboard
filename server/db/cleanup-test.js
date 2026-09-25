// Deletes ALL test data created by db/seed-test.js, and nothing else.
// Relies on the existing ON DELETE CASCADE from assignments/progress to
// users/devices, so any live assignment or progress created during manual
// testing against these test accounts/devices is removed automatically.
//
// Every DELETE below is scoped to the reserved test markers only:
//   - user emails ending in: @test.medtrain.local
//   - device names starting with: [TEST]
//   - department name: "🧪 TEST DATA — DO NOT USE"
// It is not possible for this script to touch real data, since those
// markers are never used outside of seed-test.js (and this session's own
// Phase 4 verification, which only ever created/edited [TEST]-prefixed
// devices too).
//
// Phase 10 fix: [TEST] devices can carry an uploaded image and/or video
// file under UPLOAD_DIR. The DB row is the only thing CASCADE/DELETE ever
// removed; the underlying file was left orphaned. This script now deletes
// those specific files too -- and ONLY those, identified by the exact
// path recorded on the [TEST]-matched device row being deleted, never by
// scanning or guessing at the upload directory's contents. Real devices'
// uploads are never touched because their rows are never matched by the
// `name LIKE '[TEST]%'` condition below.
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import pg from "pg";

const TEST_DEPARTMENT = "🧪 TEST DATA — DO NOT USE";
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");

function safeUnlink(assetPath) {
  if (!assetPath) return;
  const filePath = path.join(uploadDir, path.basename(assetPath));
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") console.error(`Could not remove orphaned file ${filePath}:`, err.message);
  });
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const users = await client.query("DELETE FROM users WHERE email LIKE '%@test.medtrain.local' RETURNING email");
    console.log(`Deleted ${users.rowCount} test user(s):`, users.rows.map((r) => r.email));

    const devices = await client.query(
      "DELETE FROM devices WHERE name LIKE '[TEST]%' RETURNING name, image_path, video_asset_path"
    );
    console.log(`Deleted ${devices.rowCount} test device(s):`, devices.rows.map((r) => r.name));
    let filesRemoved = 0;
    for (const row of devices.rows) {
      if (row.image_path) { safeUnlink(row.image_path); filesRemoved++; }
      if (row.video_asset_path) { safeUnlink(row.video_asset_path); filesRemoved++; }
    }
    if (filesRemoved) console.log(`Removed ${filesRemoved} orphaned upload file(s) belonging to those test devices.`);

    const depts = await client.query("DELETE FROM departments WHERE name = $1 RETURNING name", [TEST_DEPARTMENT]);
    console.log(`Deleted ${depts.rowCount} test department(s):`, depts.rows.map((r) => r.name));

    console.log("\nTest data cleanup complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
