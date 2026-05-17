export interface SimpleClienteDto {
  usuario: string;
  nombre: string;
  telefono?: string;
  id_servicio?: number;
}

export interface FacturaDto {
  id_factura: number;
  fecha_vencimiento: string;
  total: number;
  saldo: number;
  cliente: SimpleClienteDto;
}

export interface FacturasPageDto {
  count: number;
  next: string | null;
  previous: string | null;
  results: FacturaDto[];
}
