import { Module } from '@nestjs/common';
import { RatingsService } from './ratings.service';

@Module({
  providers: [RatingsService],
})
export class RatingsModule {}
