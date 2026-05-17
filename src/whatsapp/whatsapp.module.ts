import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppConnectionService } from './whatsapp-connection.service';

@Module({
  providers: [WhatsAppService, WhatsAppConnectionService],
  exports: [WhatsAppService, WhatsAppConnectionService],
})
export class WhatsAppModule {}
