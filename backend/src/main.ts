import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './core/config/env.js';

async function bootstrap() {
  // Better Auth reads the raw body itself; AuthModule re-adds parsers for the other routes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api'); // Better Auth stays on /api/auth (excluded by AuthModule)
  // whitelist: unknown fields are rejected, so a client can't sneak e.g. uploadedById into a DTO
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}
await bootstrap();
