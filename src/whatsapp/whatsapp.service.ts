import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { ClienteConFacturas } from '../wisphub/dto/cliente.dto';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly http: AxiosInstance;
  private readonly instanceName: string;
  private readonly dryRun: boolean;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: config.get<string>('evolution.apiUrl'),
      headers: { apikey: config.get<string>('evolution.apiKey') },
      timeout: 30000,
    });
    this.instanceName = config.get<string>('evolution.instanceName') ?? 'isp';
    this.dryRun = config.get<boolean>('dryRun') ?? false;
  }

  async enviarMensaje(cliente: ClienteConFacturas): Promise<void> {
    const texto = this.formatearMensaje(cliente);

    if (this.dryRun) {
      this.logger.log(
        `[DRY RUN] Mensaje NO enviado a +${cliente.telefono}:\n${texto}\n${'─'.repeat(40)}`,
      );
      return;
    }

    await this.http.post(`/message/sendText/${this.instanceName}`, {
      number: cliente.telefono,
      text: texto,
    });
  }

  private formatearMensaje(cliente: ClienteConFacturas): string {
    const listaFacturas = cliente.facturas
      .map((f) => {
        const fecha = new Date(f.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        return `• Factura #${f.id} — $${f.saldo.toFixed(2)} (venció ${fecha})`;
      })
      .join('\n');

    const n = cliente.facturas.length;
    const facturaLabel = n === 1 ? 'factura vencida' : 'facturas vencidas';

    return (
      `Hola ${cliente.nombre} 👋\n\n` +
      `Te recordamos que tienes ${n} ${facturaLabel}:\n\n` +
      `${listaFacturas}\n\n` +
      `Total adeudado: *$${cliente.totalDeuda.toFixed(2)}*\n\n` +
      `Para realizar tu pago o consultar opciones, contáctanos.`
    );
  }
}
