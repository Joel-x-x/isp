import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationLog } from './entities/notification-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url'),
        entities: [NotificationLog],
        synchronize: config.get<string>('nodeEnv') !== 'production',
        logging: config.get<string>('nodeEnv') === 'development',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
