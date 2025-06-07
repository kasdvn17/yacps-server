import { Controller, Get } from '@nestjs/common';
import { PermissionName } from 'constants/permissions';
import {
  calcProcessDurationTime,
  PermissionsService,
} from '@/helpers/permissions/permissions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private permissions: PermissionsService) {}

  @Get('/')
  getSessions() {
    const perms: PermissionName[] = ['ADMINISTRATOR'];
    const bit = this.permissions.calculate(perms);
    return this.permissions.compute(bit);
  }

  @Get('/add')
  addTest() {
    const old = process.hrtime();
    const perms: PermissionName[] = ['ADMINISTRATOR'];
    const x = this.permissions.addPerms(this.permissions.calculate(perms), [
      'VIEW_SUBMISSION_DETAILS',
      'VIEW_SUBMISSION_CODE',
    ]);
    console.log(calcProcessDurationTime(old));
    const n3ew = x.newBit;
    const a = this.permissions.hasPerms(n3ew, 'DUMMY_PERMISSION_50');
    console.log(calcProcessDurationTime(old));
    return a;
  }
}
