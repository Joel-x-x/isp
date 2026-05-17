import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { WispHubModule } from './wisphub/wisphub.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { TelegramModule } from './telegram/telegram.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.dev'],
    }),
    DatabaseModule,
    WispHubModule,
    WhatsAppModule,
    TelegramModule,
    NotificationsModule,
    SchedulerModule,
    WebhookModule,
  ],
})
export class AppModule {}
