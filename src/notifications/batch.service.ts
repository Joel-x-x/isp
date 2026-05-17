import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog, CicloTipo } from '../database/entities/notification-log.entity';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ClienteConFacturas } from '../wisphub/dto/cliente.dto';

const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 30 * 60_000];

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);
  private readonly batchSize: number;
  private readonly delayMinMs: number;
  private readonly delayMaxMs: number;
  private readonly batchPauseMinMs: number;
  private readonly batchPauseMaxMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
  ) {
    this.batchSize = config.get<number>('notifications.batchSize') ?? 20;
    this.delayMinMs = config.get<number>('notifications.delayMinMs') ?? 15_000;
    this.delayMaxMs = config.get<number>('notifications.delayMaxMs') ?? 45_000;
    this.batchPauseMinMs = config.get<number>('notifications.batchPauseMinMs') ?? 180_000;
    this.batchPauseMaxMs = config.get<number>('notifications.batchPauseMaxMs') ?? 300_000;
  }

  async filtrarYaNotificadosHoy(clientes: ClienteConFacturas[]): Promise<ClienteConFacturas[]> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const registros = await this.logRepo
      .createQueryBuilder('log')
      .select('log.clienteId')
      .where('log.fechaEnvio >= :hoy', { hoy })
      .andWhere("log.estado = 'SENT'")
      .getMany();

    const yaNotificados = new Set(registros.map((r) => r.clienteId));
    const filtrados = clientes.filter((c) => !yaNotificados.has(c.clienteId));

    const omitidos = clientes.length - filtrados.length;
    if (omitidos > 0) {
      this.logger.log(`[WISPHUB] ${omitidos} clientes ya notificados hoy — omitidos`);
    }

    return filtrados;
  }

  async procesarEnLotes(clientes: ClienteConFacturas[], ciclo: CicloTipo): Promise<{ enviados: number; fallidos: number }> {
    let enviados = 0;
    let fallidos = 0;
    const lotes = this.dividirEnLotes(clientes);

    for (let i = 0; i < lotes.length; i++) {
      this.logger.log(`[BATCH] Procesando lote ${i + 1}/${lotes.length} (${lotes[i].length} clientes)`);

      for (const cliente of lotes[i]) {
        const exito = await this.enviarConReintentos(cliente, ciclo);
        if (exito) enviados++;
        else fallidos++;

        if (cliente !== lotes[i][lotes[i].length - 1]) {
          await this.sleep(this.aleatorio(this.delayMinMs, this.delayMaxMs));
        }
      }

      if (i < lotes.length - 1) {
        const pausa = this.aleatorio(this.batchPauseMinMs, this.batchPauseMaxMs);
        const pausaMin = Math.round(pausa / 60_000 * 100) / 100;
        this.logger.log(`[BATCH] Pausa entre lotes: ${pausaMin} min`);
        await this.sleep(pausa);
      }
    }

    return { enviados, fallidos };
  }

  private async enviarConReintentos(cliente: ClienteConFacturas, ciclo: CicloTipo): Promise<boolean> {
    for (let intento = 0; intento <= 3; intento++) {
      try {
        await this.whatsapp.enviarMensaje(cliente);

        await this.registrarLog(cliente, 'SENT', ciclo, intento + 1);
        this.logger.log(
          `[WA] ✓ Enviado a ${cliente.nombre} (+${cliente.telefono}) — ` +
          `${cliente.facturas.length} facturas — $${cliente.totalDeuda.toFixed(2)}`,
        );
        return true;
      } catch (err) {
        this.logger.warn(
          `[WA] ✗ Fallo en ${cliente.nombre} (+${cliente.telefono}) — intento ${intento + 1}/3: ${err.message}`,
        );

        if (intento < 3) {
          await this.sleep(RETRY_DELAYS_MS[intento]);
        } else {
          await this.registrarLog(cliente, 'FAILED', ciclo, intento + 1, err.message);
          return false;
        }
      }
    }
    return false;
  }

  private async registrarLog(
    cliente: ClienteConFacturas,
    estado: 'SENT' | 'FAILED',
    ciclo: CicloTipo,
    intentos: number,
    errorMsg?: string,
  ): Promise<void> {
    const log = this.logRepo.create({
      clienteId: cliente.clienteId,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      facturasIds: cliente.facturas.map((f) => f.id),
      totalDeuda: cliente.totalDeuda,
      estado,
      intentos,
      errorMsg,
      ciclo,
    });
    await this.logRepo.save(log);
  }

  private dividirEnLotes<T>(arr: T[]): T[][] {
    const lotes: T[][] = [];
    for (let i = 0; i < arr.length; i += this.batchSize) {
      lotes.push(arr.slice(i, i + this.batchSize));
    }
    return lotes;
  }

  private aleatorio(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
