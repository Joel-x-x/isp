import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationCron } from './notification.cron';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  providers: [NotificationCron],
})
export class SchedulerModule {}
