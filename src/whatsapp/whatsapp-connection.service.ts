import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class WhatsAppConnectionService {
  private readonly logger = new Logger(WhatsAppConnectionService.name);
  private readonly http: AxiosInstance;
  private readonly instanceName: string;
  private isConnected = true;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: config.get<string>('evolution.apiUrl'),
      headers: { apikey: config.get<string>('evolution.apiKey') },
      timeout: 10000,
    });
    this.instanceName = config.get<string>('evolution.instanceName') ?? 'isp';
  }

  async verificarConexion(): Promise<boolean> {
    try {
      const response = await this.http.get(`/instance/connectionState/${this.instanceName}`);
      const state = response.data?.instance?.state ?? response.data?.state;
      this.isConnected = state === 'open';
      return this.isConnected;
    } catch (err) {
      this.logger.error(`[WA] Error al verificar estado de conexión: ${err.message}`);
      this.isConnected = false;
      return false;
    }
  }

  marcarConectado(): void {
    this.isConnected = true;
    this.logger.log('[WA] Estado marcado como conectado');
  }

  marcarDesconectado(): void {
    this.isConnected = false;
    this.logger.warn('[WA] Estado marcado como desconectado');
  }

  estaConectado(): boolean {
    return this.isConnected;
  }
}
