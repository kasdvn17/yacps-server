import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { SessionsService } from '../sessions/sessions.service';
import { Reflector } from '@nestjs/core';
import { Perms, Public } from './auth.decorator';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private sessionService: SessionsService,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isProtected = this.reflector.get(Public, context.getHandler());
    const requiredPerms = this.reflector.get(Perms, context.getHandler());
    if (isProtected != null) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token);

      const session = await this.sessionService.findSessionWithUser({
        id: payload.id,
      });
      if (!session || !session?.user) throw new UnauthorizedException();
      const missingPerms = requiredPerms.filter(
        (v) => !this.permissionsService.hasPerms(session.user.perms, v),
      );
      if (missingPerms.length > 0) throw new ForbiddenException();
      request['user'] = session.user;
      request['session'] = session;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
