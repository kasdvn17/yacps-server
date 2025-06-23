import { Module } from '@nestjs/common';
import { HCaptchaService } from './hcaptcha.service';

@Module({
  providers: [HCaptchaService],
  exports: [HCaptchaService],
})
export class HCaptchaModule {}
