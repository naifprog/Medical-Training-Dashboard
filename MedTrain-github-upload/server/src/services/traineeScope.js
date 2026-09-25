/**
 * Single source of truth for the Trainer -> Trainee visibility boundary.
 * "trainees.viewAll" is the one explicit permission that removes the
 * scope (Administrator, via allPermissionKeys()); every other holder of
 * trainee-related permissions (e.g. Trainer's "trainees.view") only ever
 * sees trainees whose users.trainer_id equals their own id. Permission
 * bundles, not hardcoded role names, so a future role can be granted or
 * denied this the same way.
 */
export function canSeeAllTrainees(user) {
  return !!user.permissions["trainees.viewAll"];
}
