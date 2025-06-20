import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class HCaptchaService {
  private readonly secret = process.env.HCAPTCHA_SECRET_KEY;
  private readonly verifyUrl = 'https://api.hcaptcha.com/siteverify';

  async verifyCaptcha(token: string, clientIp?: string): Promise<boolean> {
    if (!this.secret) {
      throw new BadRequestException('hCaptcha secret key not configured');
    }

    if (!token) {
      throw new BadRequestException('Captcha token is required');
    }

    try {
      const response = await axios.post(this.verifyUrl, 
        new URLSearchParams({
          secret: this.secret,
          response: token,
          remoteip: clientIp || '',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const result = response.data;
      
      if (!result.success) {
        console.error('hCaptcha verification failed:', result['error-codes']);
        return false;
      }

      return true;
    } catch (error) {
      console.error('hCaptcha verification error:', error);
      return false;
    }
  }
}
