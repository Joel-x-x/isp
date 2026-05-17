import { Controller, Post, Body, Logger, HttpCode, Query } from '@nestjs/common';
import { WhatsAppConnectionService } from '../whatsapp/whatsapp-connection.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';

interface EvolutionWebhookPayload {
  event: string;
  data?: {
    state?: string;
    [key: string]: unknown;
  };
}

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly waConnection: WhatsAppConnectionService,
    private readonly telegram: TelegramService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post('evolution')
  @HttpCode(200)
  async handleEvolutionEvent(@Body() payload: EvolutionWebhookPayload): Promise<void> {
    if (!payload?.event) return;
    const { event, data } = payload;
    this.logger.debug(`[WEBHOOK] Evento recibido: ${event}`);

    if (event !== 'CONNECTION_UPDATE') return;

    const state = data?.state;

    if (state === 'close') {
      this.waConnection.marcarDesconectado();
      await this.telegram.alertarDesconexion();
    } else if (state === 'open') {
      const estabaDesconectado = !this.waConnection.estaConectado();
      this.waConnection.marcarConectado();

      if (estabaDesconectado) {
        await this.telegram.alertarReconexion();
      }
    }
  }

  @Post('trigger')
  @HttpCode(200)
  async triggerManual(@Query('ciclo') ciclo: string): Promise<{ message: string }> {
    const tipoCiclo = ciclo === 'AFTERNOON' ? 'AFTERNOON' : 'MORNING';
    this.logger.log(`[TRIGGER] Ciclo manual iniciado: ${tipoCiclo}`);
    // No esperamos — corre en background para no bloquear el response
    void this.notifications.ejecutarCiclo(tipoCiclo as 'MORNING' | 'AFTERNOON');
    return { message: `Ciclo ${tipoCiclo} iniciado en background` };
  }
}
