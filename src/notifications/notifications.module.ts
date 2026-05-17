import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { BatchService } from './batch.service';
import { NotificationLog } from '../database/entities/notification-log.entity';
import { WispHubModule } from '../wisphub/wisphub.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationLog]),
    WispHubModule,
    WhatsAppModule,
    TelegramModule,
  ],
  providers: [NotificationsService, BatchService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
