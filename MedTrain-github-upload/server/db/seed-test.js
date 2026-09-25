// Seeds isolated, clearly-marked TEST DATA for manual QA of the three
// system roles (Administrator / Trainer / Trainee) using real accounts and
// real sessions — never touched by the real seed.js and never mixed with
// production data. Safe to re-run: every insert is existence-checked first.
//
// Everything this script creates is identifiable by:
//   - department name: "🧪 TEST DATA — DO NOT USE"
//   - user emails ending in: @test.medtrain.local
//   - device names starting with: [TEST]
//
// See db/cleanup-test.js to remove all of it again.
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const TEST_DEPARTMENT = "🧪 TEST DATA — DO NOT USE";

const TEST_USERS = [
  { fullName: "[TEST] Admin", email: "admin.test@test.medtrain.local", password: "TestAdmin123!", roleName: "Administrator" },
  { fullName: "[TEST] Trainer", email: "trainer.test@test.medtrain.local", password: "TestTrainer123!", roleName: "Trainer" },
  { fullName: "[TEST] Trainee", email: "trainee.test@test.medtrain.local", password: "TestTrainee123!", roleName: "Trainee" },
  // Added in Phase 2 to verify Trainer scope EXCLUSION (this trainee has no
  // trainer_id set, so it must never appear in [TEST] Trainer's scoped views).
  { fullName: "[TEST] Trainee 2", email: "trainee2.test@test.medtrain.local", password: "TestTrainee2123!", roleName: "Trainee" },
];

const TEST_DEVICES = [
  {
    name: "[TEST] Patient Monitor",
    deviceType: "Test Equipment",
    category: "Test",
    description: "Dummy device for QA — visible to [TEST] Trainee automatically via department match.",
    inTestDepartment: true,
    alarms: [
      { title: "[TEST] Alarm A", cause: "[TEST] dummy cause A", fix: "[TEST] dummy fix A" },
      { title: "[TEST] Alarm B", cause: "[TEST] dummy cause B", fix: "[TEST] dummy fix B" },
    ],
    quiz: [
      { question: "[TEST] Question 1 of 5", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 1 },
      { question: "[TEST] Question 2 of 5", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 0 },
      { question: "[TEST] Question 3 of 5", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 2 },
      { question: "[TEST] Question 4 of 5", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 3 },
      { question: "[TEST] Question 5 of 5", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 1 },
    ],
  },
  {
    name: "[TEST] X-Ray Unit",
    deviceType: "Test Equipment",
    category: "Test",
    description: "Dummy device for QA — NOT visible to [TEST] Trainee until explicitly assigned by an Administrator/Trainer during the test walkthrough.",
    inTestDepartment: false,
    alarms: [],
    quiz: [],
  },
];

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    let deptRes = await client.query("SELECT id FROM departments WHERE name = $1", [TEST_DEPARTMENT]);
    if (!deptRes.rows.length) {
      deptRes = await client.query("INSERT INTO departments (name) VALUES ($1) RETURNING id", [TEST_DEPARTMENT]);
      console.log(`Created test department: ${TEST_DEPARTMENT}`);
    } else {
      console.log(`Test department already exists: ${TEST_DEPARTMENT}`);
    }
    const deptId = deptRes.rows[0].id;

    for (const u of TEST_USERS) {
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [u.email]);
      if (existing.rows.length) {
        console.log(`Skipped (already exists): ${u.email}`);
        continue;
      }
      const roleRes = await client.query("SELECT id FROM roles WHERE name = $1", [u.roleName]);
      if (!roleRes.rows.length) {
        throw new Error(
          `Role "${u.roleName}" not found. Run "npm run seed" first to create the system roles.`
        );
      }
      const hash = await bcrypt.hash(u.password, 12);
      await client.query(
        `INSERT INTO users (full_name, email, password_hash, must_change_password, active, role_id, department_id)
         VALUES ($1, $2, $3, false, true, $4, $5)`,
        [u.fullName, u.email, hash, roleRes.rows[0].id, deptId]
      );
      console.log(`Created test user: ${u.email} / ${u.password} (${u.roleName})`);
    }

    for (const d of TEST_DEVICES) {
      const existing = await client.query("SELECT id FROM devices WHERE name = $1", [d.name]);
      if (existing.rows.length) {
        console.log(`Skipped (already exists): ${d.name}`);
        continue;
      }
      await client.query(
        `INSERT INTO devices (name, department_id, device_type, category, description, alarms, quiz)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          d.name,
          d.inTestDepartment ? deptId : null,
          d.deviceType,
          d.category,
          d.description,
          JSON.stringify(d.alarms),
          JSON.stringify(d.quiz),
        ]
      );
      console.log(`Created test device: ${d.name}`);
    }

    console.log("\nTest data seed complete. No assignments or progress were created —");
    console.log("exercise those live via the DevSwitcher + real UI as part of your test walkthrough.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
