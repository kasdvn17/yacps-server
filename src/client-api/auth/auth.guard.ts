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
    private sessionService: SessionsService,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isProtected = this.reflector.get(Public, context.getHandler());
    const requiredPerms = this.reflector.get(Perms, context.getHandler()) || [];
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
      if (!session) throw new UnauthorizedException();
      if (!session.user || session.expiresAt.getTime() <= Date.now()) {
        await this.sessionService.deleteSession(session.id);
        throw new UnauthorizedException();
      }

      // Validate User Agent binding
      const currentUserAgent = request.headers['x-user-agent'] as string;
      if (
        session.userAgent &&
        session.userAgent !== 'Unknown' &&
        currentUserAgent &&
        session.userAgent !== currentUserAgent
      ) {
        // User Agent mismatch - potential session hijacking
        await this.sessionService.deleteSession(session.id);
        throw new UnauthorizedException('Session invalid: User Agent mismatch');
      }

      if (requiredPerms && requiredPerms.length > 0) {
        const missingPerms = requiredPerms.filter(
          (v) => !this.permissionsService.hasPerms(session.user.perms, v),
        );
        if (missingPerms.length > 0) throw new ForbiddenException();
      }
      request['user'] = session.user;
      request['session'] = session;
    } catch (err) {
      if (err instanceof ForbiddenException) throw new ForbiddenException();
      else throw new UnauthorizedException();
    }
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
