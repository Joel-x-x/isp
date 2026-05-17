import { Module } from '@nestjs/common';
import { WispHubService } from './wisphub.service';

@Module({
  providers: [WispHubService],
  exports: [WispHubService],
})
export class WispHubModule {}
