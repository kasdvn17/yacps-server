import { Controller, Delete, Get, Post } from '@nestjs/common';

@Controller('sessions')
export class SessionsController {
  @Post('/')
  createNewSession() {}

  @Get('/me')
  getCurrentSession() {}

  @Delete('/me')
  destroyCurrentSession() {}

  // get all sessions of the currently logged in users
  @Get('/all')
  getAllSessions() {}
}
