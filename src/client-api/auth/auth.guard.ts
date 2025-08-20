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
import { PermissionsService } from './permissions.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private sessionsService: SessionsService,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isProtected =
      this.reflector.get(Public, context.getHandler()) == undefined;
    const requiredPerms = this.reflector.get(Perms, context.getHandler()) || [];

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        const session = await this.sessionsService.findSessionByIdWithUser(
          payload.id,
        );
        if (!session) throw new UnauthorizedException('INVALID_TOKEN');
        if (!session.user || session.expiresAt.getTime() <= Date.now()) {
          await this.sessionsService.deleteSession(session.id);
          throw new UnauthorizedException('INVALID_TOKEN');
        }

        if (requiredPerms && requiredPerms.length > 0) {
          const missingPerms = requiredPerms.filter(
            (v) => !this.permissionsService.hasPerms(session.user.perms, v),
          );
          if (missingPerms.length > 0)
            throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');
        }
        request['user'] = session.user;
        request['session'] = session;
      } catch (err) {
        if (err instanceof ForbiddenException)
          throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');
        else throw new UnauthorizedException('INVALID_TOKEN');
      }
    } else if (isProtected && !token)
      throw new UnauthorizedException('INVALID_TOKEN');
    return true;
  }

  /**
   * Extract a token from the Authorization header
   * @param request The request object from the execution context
   * @returns The string of the extracted token
   */
  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
