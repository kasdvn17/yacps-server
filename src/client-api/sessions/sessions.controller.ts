import { Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { Session } from '@prisma/client';

@Controller()
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post('/')
  createNewSession() {}

  @Get('/me')
  getCurrentSession() {}

  @Delete('/me')
  destroyCurrentSession() {}

  // get all sessions of the currently logged in users
  @Get('/all')
  getAllSessions() {}

  @Get('/find')
  async findSessions(@Query() queries: Session) {
    const data = await this.sessionsService.findSessions(queries);
    return data;
  }
}
