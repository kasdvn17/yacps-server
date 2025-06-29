import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secretKey: string;
  private readonly verifyUrl =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  constructor() {
    this.secretKey = process.env.TURNSTILE_SECRET_KEY || '';

    if (!this.secretKey) {
      this.logger.warn(
        'TURNSTILE_SECRET_KEY is not set! Turnstile validation will fail.',
      );
    }
  }

  /**
   * Verify a token from Cloudflare Turnstile
   * @param token The token from the client
   * @param ip Optional IP address of the user (for additional security)
   * @returns Promise resolving to whether the token is valid
   */
  async verify(token: string, ip?: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    try {
      const formData = new URLSearchParams();
      formData.append('secret', this.secretKey);
      formData.append('response', token);

      if (ip) {
        formData.append('remoteip', ip);
      }

      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const data = await response.json();

      if (!data.success) {
        this.logger.warn(
          'Turnstile validation failed:',
          data['error-codes'] || 'No error codes provided',
        );
      }

      return data.success === true;
    } catch (error) {
      this.logger.error('Error verifying Turnstile token:', error);
      return false;
    }
  }
}
