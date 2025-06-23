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

// export function calcProcessDurationTime(
//   beforeHRTime: [number, number],
// ): number {
//   const timeAfter = process.hrtime(beforeHRTime);
//   const calculated =
//     Math.floor((timeAfter[0] * 100000000 + timeAfter[1]) / 10000) / 100;
//   return calculated;
// }

@Injectable()
export class PermissionsService {
  get_bit(perm: PermissionName): PermissionBit {
    return UserPermissions[perm];
  }

  get_name(bit: PermissionBit): PermissionName {
    return Object.entries(UserPermissions).find(
      ([, v]) => v === bit,
    )?.[0] as PermissionName;
  }

  calculate(listPerms: PermissionName[]): PermissionBits {
    let bitPerms = 0n;
    listPerms.map((v) => (bitPerms |= this.get_bit(v)));
    return bitPerms;
  }

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

  // should only be used in the frontend admin to see all permissions, other modules, controllers mostly use hasPerms
  compute(bitPerms: PermissionBits): PermissionName[] {
    return Object.entries(UserPermissions)
      .filter(([, val]) => (bitPerms & val) !== 0n)
      .map(([name]) => name) as PermissionName[];
  }

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
