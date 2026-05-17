import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class NotificationCron {
  private readonly logger = new Logger(NotificationCron.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.registrarCronMorning();
    this.registrarCronAfternoon();
  }

  private registrarCronMorning(): void {
    const expresion = this.config.get<string>('notifications.cronMorning') ?? '0 9 * * 1-6';

    const job = new CronJob(expresion, () => {
      this.logger.log('[CRON] Disparando ciclo MORNING');
      this.notifications.ejecutarCiclo('MORNING').catch((err) => {
        this.logger.error(`[CRON] Error no capturado en ciclo MORNING: ${err.message}`);
      });
    });

    this.schedulerRegistry.addCronJob('notificacion-morning', job);
    job.start();
    this.logger.log(`[CRON] Job MORNING registrado: ${expresion}`);
  }

  private registrarCronAfternoon(): void {
    const expresion = this.config.get<string>('notifications.cronAfternoon') ?? '0 15 * * 1-6';

    const job = new CronJob(expresion, () => {
      this.logger.log('[CRON] Disparando ciclo AFTERNOON');
      this.notifications.ejecutarCiclo('AFTERNOON').catch((err) => {
        this.logger.error(`[CRON] Error no capturado en ciclo AFTERNOON: ${err.message}`);
      });
    });

    this.schedulerRegistry.addCronJob('notificacion-afternoon', job);
    job.start();
    this.logger.log(`[CRON] Job AFTERNOON registrado: ${expresion}`);
  }
}
