import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { Request } from 'express';
// import { SessionsService } from '../sessions/sessions.service';
// import { LoggedInUser } from '../users/users.decorator';
// import { User } from '@prisma/client';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.session || !request.user) throw new UnauthorizedException();
    // const perms =
    return true;
  }
}
