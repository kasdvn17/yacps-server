/* Permissions Hierarchy;
1. Contest
2. Problem
3. Role
Note: This follows a permission model similar to Discord's "allow - neutral - deny" system.
User roles must explicitly allow or deny permissions. If not set, permissions default to "neutral" for both contest and problem scopes.
*/

// TODO: Change the permissions order to put mostly used permissions at the top

export const UserPermissions = {
  // Roles, Permissions
  ADMINISTRATOR: 1n << 0n,
  VIEW_MANAGEMENT_PAGE: 1n << 1n,
  CREATE_ROLES: 1n << 2n,
  MODIFY_ROLES_INFO: 1n << 3n,
  MODIFY_ROLES_PERMISSIONS: 1n << 4n,
  DELETE_ROLES: 1n << 5n,

  // Users
  CHANGE_USER_STATUS: 1n << 6n,
  MANAGE_USER_BANS: 1n << 7n,
  RESET_USER_PASSWORD: 1n << 8n,
  CHANGE_USERNAME: 1n << 9n,
  CHANGE_USER_INFORMATION: 1n << 10n,
  CREATE_NEW_USERS: 1n << 11n,
  DELETE_USERS: 1n << 12n,
  EDIT_USERS_INFORMATION: 1n << 13n,

  // Sessions
  INVALIDATE_USER_SESSIONS: 1n << 14n,
  VIEW_USER_SESSIONS: 1n << 15n,
  BAN_IP_CIDR: 1n << 16n,

  // Submission
  VIEW_SUBMISSION_CODE: 1n << 17n,
  VIEW_SUBMISSION_DETAILS: 1n << 18n,
  REJUDGE_SUBMISSION: 1n << 19n,
  EDIT_SUBMISSION: 1n << 20n,
  SKIP_SUBMISSION: 1n << 21n,
  UNLIMITED_SUBMIT: 1n << 22n,
  LOCK_SUBMISSION: 1n << 23n,

  // Problems
  VIEW_DELETED_PROBLEMS: 1n << 24n,
  CREATE_NEW_PROBLEM: 1n << 25n,
  MODIFY_ALL_PROBLEMS: 1n << 26n,
  MODIFY_OWN_PROBLEMS: 1n << 27n,
  LOCK_PROBLEM: 1n << 28n,
  DELETE_PROBLEM: 1n << 29n,
  UPDATE_SOLUTIONS: 1n << 30n,
  CLONE_PROBLEM: 1n << 31n,
  EDIT_CLARIFICATIONS: 1n << 32n,
  EDIT_PROBLEM_TESTS: 1n << 33n,
  EDIT_PROBLEM_JUDGE: 1n << 34n,
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
