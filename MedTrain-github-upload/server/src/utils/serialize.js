export function serializeMe(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    employeeId: user.employeeId,
    email: user.email,
    mobile: user.mobile,
    jobTitle: user.jobTitle,
    departmentId: user.departmentId,
    departmentName: user.departmentName,
    mustChangePassword: user.mustChangePassword,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: user.permissions,
    lastLoginAt: user.lastLoginAt,
  };
}

export function serializeUserRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    employeeId: row.employee_id,
    email: row.email,
    mobile: row.mobile,
    jobTitle: row.job_title,
    departmentId: row.department_id,
    departmentName: row.department_name,
    mustChangePassword: row.must_change_password,
    active: row.active,
    roleId: row.role_id,
    roleName: row.role_name,
    permissionOverrides: row.permission_overrides,
    lastLoginAt: row.last_login_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    trainerId: row.trainer_id,
    trainerName: row.trainer_name,
  };
}

export function serializeDeviceRow(row) {
  return {
    id: row.id,
    name: row.name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    deviceType: row.device_type,
    category: row.category,
    description: row.description,
    videoUrl: row.video_url,
    videoAssetPath: row.video_asset_path,
    alarms: row.alarms,
    quiz: (row.quiz || []).map((q) => ({ ...q })),
    assignedDepartmentIds: row.assigned_department_ids || [],
    assignedToAll: row.assigned_to_all,
    createdBy: row.created_by,
    createdAt: row.created_at,
    model: row.model,
    purchaseDate: row.purchase_date,
    warrantyExpiryDate: row.warranty_expiry_date,
    imagePath: row.image_path,
    active: row.active,
    passingScore: row.passing_score,
  };
}

/** Strips correct answers from quiz questions before sending to a trainee. */
export function stripQuizAnswers(device) {
  return {
    ...device,
    quiz: (device.quiz || []).map(({ question, options }) => ({ question, options })),
  };
}

/**
 * Strips internal asset-management fields (purchase/warranty) that a
 * trainee has no legitimate need to see as part of their training
 * experience -- everything else (image, model, name, department, quiz,
 * video, alarms) stays.
 */
export function stripDeviceInternalFields(device) {
  const { purchaseDate, warrantyExpiryDate, ...rest } = device;
  return rest;
}

export function serializeProgressRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    videoStatus: row.video_status,
    videoProgressPct: Number(row.video_progress_pct),
    videoViewCount: row.video_view_count,
    videoLastViewedAt: row.video_last_viewed_at,
    videoCompletedAt: row.video_completed_at,
    quizAttempts: row.quiz_attempts,
    quizBestScore: row.quiz_best_score,
    quizLastScore: row.quiz_last_score,
    quizPassed: row.quiz_passed,
    quizPassedAt: row.quiz_passed_at,
    certificateRevoked: row.certificate_revoked,
  };
}
