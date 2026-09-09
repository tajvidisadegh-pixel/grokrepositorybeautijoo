import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { isAbsolute, normalize, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const nodeEnv = config.get<string>('nodeEnv') || process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const storageKind = (
    process.env.STORAGE_PROVIDER ||
    config.get<string>('storageProvider') ||
    'local'
  ).toLowerCase();

  // Local static serving only applies when using local disk provider
  if (storageKind === 'local' || storageKind === '') {
    const storagePath =
      process.env.STORAGE_LOCAL_PATH ||
      config.get<string>('storageLocalPath') ||
      './uploads';
    const uploadsAbs = isAbsolute(storagePath)
      ? normalize(storagePath)
      : resolve(process.cwd(), storagePath);

    try {
      if (!existsSync(uploadsAbs)) {
        mkdirSync(uploadsAbs, { recursive: true, mode: 0o755 });
      }
    } catch (err) {
      logger.error(
        `Cannot create uploads dir ${uploadsAbs}: ${(err as Error).message}`,
      );
    }

    app.useStaticAssets(uploadsAbs, {
      prefix: '/uploads/',
      setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      },
    });
    logger.log(`Static /uploads → ${uploadsAbs}`);
  } else {
    logger.log(
      `STORAGE_PROVIDER=${storageKind} — static /uploads disabled (object storage serves files)`,
    );
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS origins resolved in configuration.ts:
  // - production: CORS_ORIGINS required (no localhost-only)
  // - development: CORS_ORIGINS or localhost defaults
  const corsOrigins = config.get<string[]>('corsOrigins');
  if (!corsOrigins || corsOrigins.length === 0) {
    throw new Error(
      'FATAL: corsOrigins is empty. Set CORS_ORIGINS in the environment.',
    );
  }
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Correlation-Id'],
  });
  logger.log(`CORS origins (${isProd ? 'prod' : 'dev'}): ${corsOrigins.join(', ')}`);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger: keep available for now; item #8 will restrict to non-production
  const swagger = new DocumentBuilder()
    .setTitle('Beautijoo API')
    .setDescription('Persian RTL beauty marketplace — زیباگر booking platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') || 3000;
  await app.listen(port);
  logger.log(`Beautijoo API listening on :${port}  docs=/api/docs`);
}
bootstrap();
