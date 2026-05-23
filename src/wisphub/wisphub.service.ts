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
  private readonly mockMode: boolean;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: config.get<string>('wisphub.apiUrl'),
      headers: { Authorization: `Api-Key ${config.get<string>('wisphub.apiKey')}` },
      timeout: 30000,
    });
    this.countryCode = config.get<string>('notifications.countryCode') ?? '52';
    this.mockMode = config.get<boolean>('wisphubMock') ?? false;
  }

  async obtenerClientesConFacturasVencidas(): Promise<ClienteConFacturas[]> {
    if (this.mockMode) {
      const clientes = this.generarClientesMock();
      this.logger.log(`[WISPHUB][MOCK] ${clientes.length} clientes mock generados`);
      return clientes;
    }

    const hoy = new Date().toISOString().split('T')[0];
    const facturas = await this.fetchTodasLasFacturasVencidas(hoy);

    this.logger.log(`[WISPHUB] ${facturas.length} facturas vencidas obtenidas`);

    const agrupadas = await this.agruparPorCliente(facturas);

    this.logger.log(`[WISPHUB] ${agrupadas.length} clientes con facturas vencidas`);

    return agrupadas;
  }

  private generarClientesMock(): ClienteConFacturas[] {
    const telefono = this.normalizarTelefono('0960801963')!;
    const nombres = [
      'Carlos Pérez', 'María López', 'Juan García', 'Ana Martínez', 'Luis Rodríguez',
      'Sofia Torres', 'Diego Flores', 'Valentina Cruz', 'Andrés Morales', 'Camila Jiménez',
      'Pablo Romero', 'Isabella Vargas', 'Mateo Herrera', 'Gabriela Mendoza', 'Ricardo Castillo',
      'Fernanda Ramos', 'Sebastián Guerrero', 'Daniela Ortiz', 'Alejandro Reyes', 'Natalia Soto',
      'Esteban Díaz', 'Luciana Vega', 'Tomás Mora', 'Verónica Aguilar', 'Cristian Ríos',
    ];
    const montos = [22, 28, 35, 45, 50, 18, 30, 40, 55, 25];
    const diasAtraso = [5, 10, 15, 20, 30, 45, 7, 12, 25, 60];

    return nombres.map((nombre, i) => {
      const hoy = new Date();
      const venc1 = new Date(hoy);
      venc1.setDate(hoy.getDate() - diasAtraso[i % diasAtraso.length]);
      const monto1 = montos[i % montos.length];

      const facturas: ClienteConFacturas['facturas'] = [
        {
          id: 1000 + i,
          fechaVencimiento: venc1.toISOString().split('T')[0],
          total: monto1,
          saldo: monto1,
        },
      ];

      // Algunos clientes tienen 2 facturas vencidas
      if (i % 3 === 0) {
        const venc2 = new Date(hoy);
        venc2.setDate(hoy.getDate() - diasAtraso[i % diasAtraso.length] - 30);
        const monto2 = montos[(i + 1) % montos.length];
        facturas.push({
          id: 2000 + i,
          fechaVencimiento: venc2.toISOString().split('T')[0],
          total: monto2,
          saldo: monto2,
        });
      }

      const totalDeuda = parseFloat(facturas.reduce((s, f) => s + f.saldo, 0).toFixed(2));

      return {
        clienteId: `cliente${i + 1}@mock-isp`,
        nombre,
        telefono,
        facturas,
        totalDeuda,
      };
    });
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
        fecha_vencimiento__range_0: '2000-01-01',
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

    // Ya tiene código de país: debe tener más dígitos que solo el código
    const minLongitudConCodigo = this.countryCode.length + 8;
    if (soloDigitos.startsWith(this.countryCode) && soloDigitos.length >= minLongitudConCodigo) {
      return soloDigitos;
    }

    //Strip leading 0 (formato local: 0960801963 → 960801963 → 593960801963)
    const sinCero = soloDigitos.startsWith('0') ? soloDigitos.slice(1) : soloDigitos;
    return `${this.countryCode}${sinCero}`;
  }
}
