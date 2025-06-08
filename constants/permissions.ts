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
  VIEW_ADMIN_PAGE: 1n << 1n,
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

  // Sessions
  INVALIDATE_USER_SESSIONS: 1n << 11n,
  VIEW_USER_SESSIONS: 1n << 12n,
  BAN_IP_CIDR: 1n << 13n,

  // Submission
  VIEW_SUBMISSION_CODE: 1n << 14n,
  VIEW_SUBMISSION_DETAILS: 1n << 15n,
  REJUDGE_SUBMISSION: 1n << 16n,
  EDIT_SUBMISSION: 1n << 17n,
  SKIP_SUBMISSION: 1n << 18n,
  UNLIMITED_SUBMIT: 1n << 19n,
  LOCK_SUBMISSION: 1n << 20n,

  // Dummy permissions to reach 70
  DUMMY_PERMISSION_1: 1n << 21n,
  DUMMY_PERMISSION_2: 1n << 22n,
  DUMMY_PERMISSION_3: 1n << 23n,
  DUMMY_PERMISSION_4: 1n << 24n,
  DUMMY_PERMISSION_5: 1n << 25n,
  DUMMY_PERMISSION_6: 1n << 26n,
  DUMMY_PERMISSION_7: 1n << 27n,
  DUMMY_PERMISSION_8: 1n << 28n,
  DUMMY_PERMISSION_9: 1n << 29n,
  DUMMY_PERMISSION_10: 1n << 30n,
  DUMMY_PERMISSION_11: 1n << 31n,
  DUMMY_PERMISSION_12: 1n << 32n,
  DUMMY_PERMISSION_13: 1n << 33n,
  DUMMY_PERMISSION_14: 1n << 34n,
  DUMMY_PERMISSION_15: 1n << 35n,
  DUMMY_PERMISSION_16: 1n << 36n,
  DUMMY_PERMISSION_17: 1n << 37n,
  DUMMY_PERMISSION_18: 1n << 38n,
  DUMMY_PERMISSION_19: 1n << 39n,
  DUMMY_PERMISSION_20: 1n << 40n,
  DUMMY_PERMISSION_21: 1n << 41n,
  DUMMY_PERMISSION_22: 1n << 42n,
  DUMMY_PERMISSION_23: 1n << 43n,
  DUMMY_PERMISSION_24: 1n << 44n,
  DUMMY_PERMISSION_25: 1n << 45n,
  DUMMY_PERMISSION_26: 1n << 46n,
  DUMMY_PERMISSION_27: 1n << 47n,
  DUMMY_PERMISSION_28: 1n << 48n,
  DUMMY_PERMISSION_29: 1n << 49n,
  DUMMY_PERMISSION_30: 1n << 50n,
  DUMMY_PERMISSION_31: 1n << 51n,
  DUMMY_PERMISSION_32: 1n << 52n,
  DUMMY_PERMISSION_33: 1n << 53n,
  DUMMY_PERMISSION_34: 1n << 54n,
  DUMMY_PERMISSION_35: 1n << 55n,
  DUMMY_PERMISSION_36: 1n << 56n,
  DUMMY_PERMISSION_37: 1n << 57n,
  DUMMY_PERMISSION_38: 1n << 58n,
  DUMMY_PERMISSION_39: 1n << 59n,
  DUMMY_PERMISSION_40: 1n << 60n,
  DUMMY_PERMISSION_41: 1n << 61n,
  DUMMY_PERMISSION_42: 1n << 62n,
  DUMMY_PERMISSION_43: 1n << 63n,
  DUMMY_PERMISSION_44: 1n << 64n,
  DUMMY_PERMISSION_45: 1n << 65n,
  DUMMY_PERMISSION_46: 1n << 66n,
  DUMMY_PERMISSION_47: 1n << 67n,
  DUMMY_PERMISSION_48: 1n << 68n,
  DUMMY_PERMISSION_49: 1n << 69n,
  DUMMY_PERMISSION_50: 1n << 70n,
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
