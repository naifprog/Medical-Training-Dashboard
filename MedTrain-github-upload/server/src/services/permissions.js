export const PERMISSION_GROUPS = {
  training: ["view", "create", "edit", "delete", "publish"],
  devices: ["view", "create", "edit", "delete", "assign"],
  trainees: ["view", "create", "edit", "deactivate", "viewAll"],
  assignments: ["view", "create", "edit", "cancel"],
  quiz: ["view", "create", "edit", "delete", "results"],
  reports: ["view", "export", "performance", "completion"],
  certificates: ["view", "issue", "revoke"],
  users: ["view", "create", "edit", "deactivate", "rolesCreate", "rolesEdit", "rolesDelete", "rolesAssign"],
  settings: ["manage"],
  audit: ["view"],
};

export function allPermissionKeys() {
  const keys = [];
  for (const [group, perms] of Object.entries(PERMISSION_GROUPS)) {
    for (const p of perms) keys.push(`${group}.${p}`);
  }
  return keys;
}

export function isValidPermissionKey(key) {
  const [group, perm] = String(key).split(".");
  return !!PERMISSION_GROUPS[group] && PERMISSION_GROUPS[group].includes(perm);
}

function permMapFromList(list) {
  const map = {};
  for (const k of list) map[k] = true;
  return map;
}

export const ROLE_SEED = {
  Administrator: permMapFromList(allPermissionKeys()),
  Trainer: permMapFromList([
    "training.view", "training.create", "training.edit", "training.publish",
    "devices.view", "devices.create", "devices.edit", "devices.assign",
    "trainees.view",
    "assignments.view", "assignments.create", "assignments.edit",
    "quiz.view", "quiz.create", "quiz.edit", "quiz.results",
    "reports.view", "reports.performance", "reports.completion",
    "certificates.view", "certificates.issue",
  ]),
  Trainee: permMapFromList(["training.view", "devices.view", "quiz.view", "certificates.view"]),
};

/** Merge order: role permissions first, then per-user overrides win. */
export function effectivePermissions(rolePermissions, overrides) {
  return { ...(rolePermissions || {}), ...(overrides || {}) };
}

export function can(effective, key) {
  return !!effective?.[key];
}
