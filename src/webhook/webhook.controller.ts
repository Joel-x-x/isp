import { Controller, Post, Get, Body, Logger, HttpCode, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery, ApiResponse, ApiBody, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { WhatsAppConnectionService } from '../whatsapp/whatsapp-connection.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WispHubService } from '../wisphub/wisphub.service';
import { ClienteConFacturas } from '../wisphub/dto/cliente.dto';

interface EvolutionWebhookPayload {
  event: string;
  data?: {
    state?: string;
    [key: string]: unknown;
  };
}

@ApiTags('webhook')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  private readonly webhookSecret: string;

  constructor(
    private readonly waConnection: WhatsAppConnectionService,
    private readonly telegram: TelegramService,
    private readonly notifications: NotificationsService,
    private readonly wisphub: WispHubService,
    private readonly config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('webhookSecret') ?? '';
  }

  @Post('evolution')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recibe eventos de Evolution API (CONNECTION_UPDATE)' })
  @ApiBody({
    schema: {
      example: {
        event: 'CONNECTION_UPDATE',
        data: { state: 'open' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Evento procesado' })
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

  @Get('preview')
  @ApiOperation({ summary: 'Consulta clientes con facturas vencidas en WispHub (solo lectura)' })
  @ApiSecurity('webhook-secret')
  @ApiHeader({ name: 'x-webhook-secret', description: 'Secret configurado en WEBHOOK_SECRET', required: true })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes con facturas vencidas agrupadas',
    schema: {
      example: {
        total: 47,
        clientes: [
          {
            clienteId: 'juan@empresa',
            nombre: 'Juan Pérez',
            telefono: '521999123456',
            facturas: [{ id: 101, fechaVencimiento: '2026-05-01', total: 50, saldo: 50 }],
            totalDeuda: 50,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Secret inválido o ausente' })
  async preview(
    @Headers('x-webhook-secret') secret: string,
  ): Promise<{ total: number; clientes: ClienteConFacturas[] }> {
    if (!this.webhookSecret || secret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid or missing webhook secret');
    }
    const clientes = await this.wisphub.obtenerClientesConFacturasVencidas();
    return { total: clientes.length, clientes };
  }

  @Post('trigger')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dispara un ciclo manualmente (corre en background)' })
  @ApiSecurity('webhook-secret')
  @ApiHeader({ name: 'x-webhook-secret', description: 'Secret configurado en WEBHOOK_SECRET', required: true })
  @ApiQuery({ name: 'ciclo', enum: ['MORNING', 'AFTERNOON'], required: false, description: 'Default: MORNING' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Ciclo MORNING iniciado en background' } } })
  @ApiResponse({ status: 401, description: 'Secret inválido o ausente' })
  async triggerManual(
    @Query('ciclo') ciclo: string,
    @Headers('x-webhook-secret') secret: string,
  ): Promise<{ message: string }> {
    if (!this.webhookSecret || secret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid or missing webhook secret');
    }
    const tipoCiclo = ciclo === 'AFTERNOON' ? 'AFTERNOON' : 'MORNING';
    this.logger.log(`[TRIGGER] Ciclo manual iniciado: ${tipoCiclo}`);
    // No esperamos — corre en background para no bloquear el response
    void this.notifications.ejecutarCiclo(tipoCiclo as 'MORNING' | 'AFTERNOON');
    return { message: `Ciclo ${tipoCiclo} iniciado en background` };
  }
}
