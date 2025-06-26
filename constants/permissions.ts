/* Permissions Hierarchy;
1. Contest
2. Problem
3. Role
Note: This follows a permission model similar to Discord's "allow - neutral - deny" system.
User roles must explicitly allow or deny permissions. If not set, permissions default to "neutral" for both contest and problem scopes.
*/

// TODO: Change the permissions order to put mostly used permissions at the top

export const UserPermissions = {
  // Special
  ADMINISTRATOR: 1n << 0n,

  // Web
  VIEW_MANAGEMENT_PAGE: 1n << 1n,
  INVALIDATE_GLOBAL_CACHE: 1n << 2n,

  // Roles, Permissions
  CREATE_ROLES: 1n << 3n,
  MODIFY_ROLES_INFO: 1n << 4n,
  MODIFY_ROLES_PERMISSIONS: 1n << 5n,
  DELETE_ROLES: 1n << 6n,

  // Users
  CHANGE_USER_STATUS: 1n << 7n,
  MANAGE_USER_BANS: 1n << 8n,
  RESET_USER_PASSWORD: 1n << 9n,
  EDIT_USERS_INFO: 1n << 10n,
  EDIT_USERS_PERMISSIONS: 1n << 11n,
  DELETE_USERS: 1n << 12n,

  // Sessions
  INVALIDATE_USER_SESSIONS: 1n << 15n,
  VIEW_USER_SESSIONS: 1n << 16n,
  BAN_IP_CIDR: 1n << 17n,

  // Submission
  VIEW_SUBMISSION_CODE: 1n << 18n,
  VIEW_SUBMISSION_DETAILS: 1n << 19n,
  REJUDGE_SUBMISSION: 1n << 20n,
  EDIT_SUBMISSION: 1n << 21n,
  SKIP_SUBMISSION: 1n << 22n,
  UNLIMITED_SUBMISSIONS: 1n << 23n,
  CHANGE_SUBMISSION_STATUS: 1n << 24n, // active, aborted, locked

  // Problems
  VIEW_ALL_PROBLEMS: 1n << 25n,
  CREATE_NEW_PROBLEM: 1n << 26n,
  MODIFY_ALL_PROBLEMS: 1n << 27n,
  MODIFY_PERMITTED_PROBLEMS: 1n << 28n,
  CHANGE_PROBLEM_STATUS: 1n << 29n, // locked, hidden, active
  DELETE_PROBLEM: 1n << 30n,
  UPDATE_SOLUTIONS: 1n << 31n,
  CLONE_PROBLEM: 1n << 32n,
  EDIT_CLARIFICATIONS: 1n << 33n,
  EDIT_PROBLEM_TESTS: 1n << 34n,
} as const;

export type PermissionName = keyof typeof UserPermissions;
export type PermissionBit = (typeof UserPermissions)[PermissionName];
export type PermissionBits = bigint;

export const PermissionsDependencies = new Map<PermissionBit, PermissionBit[]>([
  [
    UserPermissions.VIEW_SUBMISSION_CODE,
    [UserPermissions.VIEW_SUBMISSION_DETAILS],
  ],
]);
