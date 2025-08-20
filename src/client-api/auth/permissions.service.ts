import { Injectable } from '@nestjs/common';
import {
  PermissionBit,
  PermissionBits,
  PermissionName,
  PermissionsDependencies,
  UserPermissions,
} from 'constants/permissions';
import {
  IAddPermsResponse,
  IAddPermsResponseFailed,
} from './permissions.interface';

@Injectable()
export class PermissionsService {
  /**
   * Get the bit for a given permission name.
   * @param perm Permission name to get the bit for
   * @returns The bit for the given permission name
   */
  get_bit(perm: PermissionName): PermissionBit {
    return UserPermissions[perm];
  }

  /**
   * Get the permission name for a given bit.
   * @param bit Permission bit to get the name for
   * @returns The permission name for the given bit
   */
  get_name(bit: PermissionBit): PermissionName {
    return Object.entries(UserPermissions).find(
      ([, v]) => v === bit,
    )?.[0] as PermissionName;
  }

  /**
   * Calculate the bit permissions for a list of permission names.
   * @param listPerms List of permission names to calculate the bits for
   * @returns The calculated permission bits
   */
  calculate(listPerms: PermissionName[]): PermissionBits {
    let bitPerms = 0n;
    listPerms.map((v) => (bitPerms |= this.get_bit(v)));
    return bitPerms;
  }

  /**
   * Check if a user has a specific permission.
   * @param bitPerms The user's permission bits
   * @param permToCheck The permission to check, either as a PermissionBit or PermissionName
   * @returns The boolean indicating the presence of the permission
   */
  hasPerms(
    bitPerms: PermissionBits,
    permToCheck: PermissionBit | PermissionName,
  ): boolean {
    if ((bitPerms & UserPermissions.ADMINISTRATOR) != 0n) return true;
    if (typeof permToCheck == 'string') {
      return (bitPerms & this.get_bit(permToCheck)) == 0n ? false : true;
    } else {
      return (bitPerms & permToCheck) == 0n ? false : true;
    }
  }

  /**
   * Compute the permission names from the bit permissions.
   * @param bitPerms The user's permission bits
   * @returns An array of permission names that the user has
   * @description This function should only be used in the frontend admin to see all permissions due to performance issues.
   */
  compute(bitPerms: PermissionBits): PermissionName[] {
    return Object.entries(UserPermissions)
      .filter(([, val]) => (bitPerms & val) !== 0n)
      .map(([name]) => name) as PermissionName[];
  }

  /**
   * Add permissions to the user's permission bits.
   * @param bitPerms The user's current permission bits
   * @param permsToAdd The list of permissions to add
   * @returns An object containing the new permission bits and the success/failure of adding each permission
   */
  addPerms(
    bitPerms: PermissionBits,
    permsToAdd: PermissionName[],
  ): IAddPermsResponse {
    const noDependency = permsToAdd.filter(
      (v) => !PermissionsDependencies.has(this.get_bit(v)),
    );
    const hasDependencies = permsToAdd.filter((v) => !noDependency.includes(v));
    noDependency.map((v) => (bitPerms |= this.get_bit(v)));
    const success: PermissionName[] = [...noDependency];
    const failed: IAddPermsResponseFailed[] = [];
    hasDependencies.map((v) => {
      const dependencies = PermissionsDependencies.get(this.get_bit(v));
      const missing: PermissionName[] = [];
      dependencies?.map((dependency) => {
        if (typeof dependency != 'number') return;
        if (!this.hasPerms(bitPerms, dependency))
          missing.push(this.get_name(dependency));
      });
      if (missing.length == 0) {
        bitPerms |= this.get_bit(v);
        success.push(v);
      } else
        failed.push({
          name: v,
          missing_dependency: missing,
        });
    });
    return {
      success,
      failed,
      newBit: bitPerms,
    };
  }
}
