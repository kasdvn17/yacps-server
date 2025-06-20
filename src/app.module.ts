import { Module } from '@nestjs/common';
import { ClientAPIModule } from './client-api/client-api.module';
import { JudgeAPIModule } from './judge-api/judge-api.module';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ClientAPIModule,
    JudgeAPIModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute for general rate limiting
        getTracker: (req) => {
          // Try to get real IP from various headers
          const xForwardedFor = req.headers['x-forwarded-for'];
          const xRealIp = req.headers['x-real-ip'];
          const cfConnectingIp = req.headers['cf-connecting-ip'];
          const xConnectingIp = req.headers['x-connecting-ip'];

          // Return first valid IP found
          if (cfConnectingIp && typeof cfConnectingIp === 'string') {
            return cfConnectingIp;
          }
          if (xConnectingIp && typeof xConnectingIp === 'string') {
            return xConnectingIp;
          }
          if (xRealIp && typeof xRealIp === 'string') {
            return xRealIp;
          }
          if (xForwardedFor) {
            // X-Forwarded-For can contain multiple IPs, get the first one
            const forwarded = Array.isArray(xForwardedFor)
              ? xForwardedFor[0]
              : xForwardedFor;
            const firstIp = forwarded.split(',')[0].trim();
            if (firstIp) return firstIp;
          }

          // Fallback to connection IP
          return req.ip || req.connection?.remoteAddress || 'unknown';
        },
      },
    ]),
    RouterModule.register([
      {
        path: '/client',
        module: ClientAPIModule,
      },
      {
        path: '/judge',
        module: JudgeAPIModule,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
