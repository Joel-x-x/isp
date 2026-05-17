import { Injectable, Logger } from '@nestjs/common';
import { WispHubService } from '../wisphub/wisphub.service';
import { WhatsAppConnectionService } from '../whatsapp/whatsapp-connection.service';
import { TelegramService } from '../telegram/telegram.service';
import { BatchService } from './batch.service';
import { CicloTipo } from '../database/entities/notification-log.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly wisphub: WispHubService,
    private readonly waConnection: WhatsAppConnectionService,
    private readonly telegram: TelegramService,
    private readonly batch: BatchService,
  ) {}

  async ejecutarCiclo(ciclo: CicloTipo): Promise<void> {
    const inicio = Date.now();
    this.logger.log(`[CRON] Ciclo ${ciclo} iniciado — ${new Date().toISOString()}`);

    const conectado = await this.waConnection.verificarConexion();
    if (!conectado) {
      this.logger.warn(`[CRON] WhatsApp desconectado — abortando ciclo ${ciclo}`);
      await this.telegram.alertarDesconexion();
      return;
    }

    try {
      const clientes = await this.wisphub.obtenerClientesConFacturasVencidas();

      if (clientes.length === 0) {
        this.logger.log(`[CRON] Sin clientes con facturas vencidas — ciclo ${ciclo} finalizado`);
        return;
      }

      const pendientes = await this.batch.filtrarYaNotificadosHoy(clientes);

      if (pendientes.length === 0) {
        this.logger.log(`[CRON] Todos los clientes ya fueron notificados hoy — ciclo ${ciclo} finalizado`);
        return;
      }

      const { enviados, fallidos } = await this.batch.procesarEnLotes(pendientes, ciclo);

      const duracionMin = Math.round((Date.now() - inicio) / 60_000);
      this.logger.log(
        `[CRON] Ciclo ${ciclo} completado — ${enviados} enviados, ${fallidos} fallidos — duración: ${duracionMin} min`,
      );

      await this.telegram.reportarCicloCompletado(ciclo, enviados, fallidos, duracionMin);
    } catch (err) {
      this.logger.error(`[CRON] Error en ciclo ${ciclo}: ${err.message}`, err.stack);
      await this.telegram.alertarErrorCiclo(ciclo, err.message);
    }
  }
}
