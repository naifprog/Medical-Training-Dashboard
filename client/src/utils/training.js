// Shared training-status derivation, used by Trainee Profile, Dashboards,
// and Reports so the same assignment+progress pair always yields the same
// status everywhere.
//
// assignment = trainer/admin's record of what was assigned (lifecycle:
//   active/cancelled, due date). progress = the trainee's actual
//   completion/results. The two are kept conceptually separate here.

export function todayDateOnly() {
  // Plain "YYYY-MM-DD", UTC-based, deliberately not a Date object -- avoids
  // any local-timezone drift when compared against a due_date string.
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(assignment, progress) {
  if (!assignment.dueDate) return false;
  if (assignment.status === "cancelled") return false;
  if (isCompleted(progress)) return false;
  return assignment.dueDate < todayDateOnly();
}

export function isCompleted(progress) {
  return progress?.videoStatus === "completed" && !!progress?.quizPassed;
}

export function isStarted(progress) {
  if (!progress) return false;
  return progress.videoStatus === "in_progress" || progress.videoStatus === "completed" || (progress.quizAttempts || []).length > 0;
}

/** Returns one of: "cancelled" | "completed" | "overdue" | "in_progress" | "not_started" */
export function trainingStatus(assignment, progress) {
  if (assignment.status === "cancelled") return "cancelled";
  if (isCompleted(progress)) return "completed";
  if (isOverdue(assignment, progress)) return "overdue";
  return isStarted(progress) ? "in_progress" : "not_started";
}
