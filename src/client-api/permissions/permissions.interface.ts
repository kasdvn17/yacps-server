import { PermissionBit, PermissionName } from 'constants/permissions';

export interface IAddPermsResponseFailed {
  name: PermissionName;
  missing_dependency: PermissionName[];
}

export interface IAddPermsResponse {
  success: PermissionName[];
  failed: IAddPermsResponseFailed[];
  newBit: PermissionBit;
}
