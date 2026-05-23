import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WispHubModule } from '../wisphub/wisphub.module';

@Module({
  imports: [WhatsAppModule, TelegramModule, NotificationsModule, WispHubModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
