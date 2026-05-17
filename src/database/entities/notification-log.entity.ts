import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type NotificationEstado = 'SENT' | 'FAILED' | 'PENDING';
export type CicloTipo = 'MORNING' | 'AFTERNOON';

@Entity('notification_log')
@Index(['clienteId', 'fechaEnvio'])
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cliente_id', length: 100 })
  clienteId: string;

  @Column({ nullable: true, length: 200 })
  nombre: string;

  @Column({ length: 20 })
  telefono: string;

  @Column({ name: 'facturas_ids', type: 'int', array: true })
  facturasIds: number[];

  @Column({ name: 'total_deuda', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalDeuda: number;

  @Column({ length: 10 })
  estado: NotificationEstado;

  @Column({ default: 1 })
  intentos: number;

  @Column({ name: 'error_msg', type: 'text', nullable: true })
  errorMsg: string;

  @Column({ length: 10, nullable: true })
  ciclo: CicloTipo;

  @Column({ name: 'fecha_envio', type: 'timestamptz', default: () => 'NOW()' })
  fechaEnvio: Date;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamptz' })
  fechaCreacion: Date;
}
