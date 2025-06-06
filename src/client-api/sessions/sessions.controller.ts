import { Controller, Get } from '@nestjs/common';
import { PermissionName } from 'constants/permissions';
import { Permissions } from '@/helpers/permissions/permissions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private permissions: Permissions) {}

  @Get('/')
  getSessions() {
    const perms: PermissionName[] = ['ADMINISTRATOR'];
    const bit = this.permissions.calculate(perms);
    return this.permissions.compute(bit);
  }

  @Get('/add')
  addTest() {
    const perms: PermissionName[] = ['ADMINISTRATOR'];
    const x = this.permissions.addPerms(this.permissions.calculate(perms), [
      'VIEW_SUBMISSION_DETAILS',
      'VIEW_SUBMISSION_CODE',
    ]);
    console.log(x);
    const n3ew = x.newBit;
    return this.permissions.compute(n3ew);
  }
}
