export interface ClienteDetalleDto {
  id_servicio: number;
  usuario: string;
  nombre: string;
  telefono: string;
}

export interface ClienteConFacturas {
  clienteId: string;
  nombre: string;
  telefono: string;
  facturas: {
    id: number;
    fechaVencimiento: string;
    total: number;
    saldo: number;
  }[];
  totalDeuda: number;
}
