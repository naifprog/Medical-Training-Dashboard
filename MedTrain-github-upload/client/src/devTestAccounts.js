// Dev-only test accounts, created by `npm run seed:test` in server/.
// Consumed only by DevSwitcher.jsx, which is itself excluded from
// production builds via import.meta.env.DEV. Safe to delete this file
// entirely once the testing phase is over (alongside DevSwitcher.jsx and
// server/db/{seed-test,cleanup-test}.js).
export const DEV_TEST_ACCOUNTS = [
  { role: "Administrator", email: "admin.test@test.medtrain.local", password: "TestAdmin123!" },
  { role: "Trainer", email: "trainer.test@test.medtrain.local", password: "TestTrainer123!" },
  { role: "Trainee", email: "trainee.test@test.medtrain.local", password: "TestTrainee123!" },
];
