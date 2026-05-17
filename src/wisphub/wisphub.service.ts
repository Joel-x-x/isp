import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { FacturaDto, FacturasPageDto } from './dto/factura.dto';
import { ClienteConFacturas, ClienteDetalleDto } from './dto/cliente.dto';

@Injectable()
export class WispHubService {
  private readonly logger = new Logger(WispHubService.name);
  private readonly http: AxiosInstance;
  private readonly countryCode: string;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: config.get<string>('wisphub.apiUrl'),
      headers: { Authorization: `Token ${config.get<string>('wisphub.apiKey')}` },
      timeout: 30000,
    });
    this.countryCode = config.get<string>('notifications.countryCode') ?? '52';
  }

  async obtenerClientesConFacturasVencidas(): Promise<ClienteConFacturas[]> {
    const hoy = new Date().toISOString().split('T')[0];
    const facturas = await this.fetchTodasLasFacturasVencidas(hoy);

    this.logger.log(`[WISPHUB] ${facturas.length} facturas vencidas obtenidas`);

    const agrupadas = await this.agruparPorCliente(facturas);

    this.logger.log(`[WISPHUB] ${agrupadas.length} clientes con facturas vencidas`);

    return agrupadas;
  }

  private async fetchTodasLasFacturasVencidas(fechaHoy: string): Promise<FacturaDto[]> {
    const todas: FacturaDto[] = [];
    let offset = 0;
    const limit = 100;

    do {
      const page = await this.fetchPagina(fechaHoy, offset, limit);
      todas.push(...page.results);
      offset += limit;

      if (page.next === null) break;
    } while (true);

    return todas;
  }

  private async fetchPagina(fechaHoy: string, offset: number, limit: number): Promise<FacturasPageDto> {
    const response = await this.http.get<FacturasPageDto>('/facturas/', {
      params: {
        estado: 1,
        fecha_vencimiento__range_1: fechaHoy,
        limit,
        offset,
      },
    });
    return response.data;
  }

  private async agruparPorCliente(facturas: FacturaDto[]): Promise<ClienteConFacturas[]> {
    const mapa = new Map<string, ClienteConFacturas>();

    for (const factura of facturas) {
      const { usuario, nombre, telefono, id_servicio } = factura.cliente;

      if (!mapa.has(usuario)) {
        const telefonoNormalizado = telefono
          ? this.normalizarTelefono(telefono)
          : await this.fetchTelefonoCliente(id_servicio, usuario);

        if (!telefonoNormalizado) {
          this.logger.warn(`[WISPHUB] Omitiendo cliente ${usuario} — sin teléfono válido`);
          continue;
        }

        mapa.set(usuario, {
          clienteId: usuario,
          nombre,
          telefono: telefonoNormalizado,
          facturas: [],
          totalDeuda: 0,
        });
      }

      const cliente = mapa.get(usuario)!;
      cliente.facturas.push({
        id: factura.id_factura,
        fechaVencimiento: factura.fecha_vencimiento,
        total: factura.total,
        saldo: factura.saldo,
      });
      cliente.totalDeuda = parseFloat((cliente.totalDeuda + factura.saldo).toFixed(2));
    }

    return Array.from(mapa.values());
  }

  private async fetchTelefonoCliente(idServicio: number | undefined, usuario: string): Promise<string | null> {
    if (!idServicio) return null;

    try {
      const response = await this.http.get<ClienteDetalleDto>(`/clientes/${idServicio}/`);
      const tel = response.data.telefono;
      return tel ? this.normalizarTelefono(tel) : null;
    } catch (err) {
      this.logger.error(`[WISPHUB] Error al obtener teléfono de cliente ${usuario}: ${err.message}`);
      return null;
    }
  }

  private normalizarTelefono(telefono: string): string | null {
    const soloDigitos = telefono.replace(/\D/g, '');

    if (soloDigitos.length < 8) return null;

    // Ya tiene código de país
    if (soloDigitos.startsWith(this.countryCode) && soloDigitos.length >= 10) {
      return soloDigitos;
    }

    return `${this.countryCode}${soloDigitos}`;
  }
}
