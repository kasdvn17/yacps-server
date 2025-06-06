export const UserPermissions = {
  ADMINISTRATOR: 1 << 0,
  VIEW_SUBMISSION_CODE: 1 << 1,
  VIEW_SUBMISSION_DETAILS: 1 << 2,
  // VIEW_SUBMISSION_CODE depends on VIEW_SUBMISSION_DETAILS
} as const;

export type PermissionName = keyof typeof UserPermissions;
export type PermissionBit = (typeof UserPermissions)[PermissionName];
export type PermissionBits = number;

export const PermissionsDependencies: Partial<
  Record<PermissionBit, PermissionBit[]>
> = {
  [UserPermissions.VIEW_SUBMISSION_CODE]: [
    UserPermissions.VIEW_SUBMISSION_DETAILS,
  ],
};
