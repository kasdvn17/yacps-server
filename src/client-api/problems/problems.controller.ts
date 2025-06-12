import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Perms } from '../auth/auth.decorator';
import { UserPermissions } from 'constants/permissions';

@Controller()
export class ProblemsController {
  @Get('/')
  getAllProblems() {}

  @Get('/:id')
  getSpecificProblem() {}

  @Post('/')
  @UseGuards(AuthGuard)
  @Perms([UserPermissions.CREATE_NEW_PROBLEM])
  createProblem() {}
}
