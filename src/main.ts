import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['log', 'warn', 'error']
        : ['log', 'debug', 'verbose', 'warn', 'error'],
  });

  const config = new DocumentBuilder()
    .setTitle('ISP Bot API')
    .setDescription('Sistema de notificación de facturas vencidas vía WhatsApp')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-webhook-secret' }, 'webhook-secret')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
