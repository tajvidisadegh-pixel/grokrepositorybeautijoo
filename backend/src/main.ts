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

  const smsProvider = (process.env.SMS_PROVIDER || config.get<string>('smsProvider') || 'mock').toLowerCase();
  if (isProd && (smsProvider === 'mock' || smsProvider === '')) {
    logger.warn(
      'SMS_PROVIDER is mock/empty in production — OTP codes will NOT be delivered to real phones. Set SMS_PROVIDER to your live provider.',
    );
  }

  const paymentProvider = (process.env.PAYMENT_PROVIDER || config.get<string>('paymentProvider') || '').toLowerCase();
  if (isProd && (!paymentProvider || paymentProvider === 'mock')) {
    logger.warn(
      'PAYMENT_PROVIDER is empty/mock in production — online payments are disabled or test-only.',
    );
  }

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

  if (!isProd) {
    const swagger = new DocumentBuilder()
      .setTitle('Beautijoo API')
      .setDescription('Persian RTL beauty marketplace — زیباگر booking platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger UI enabled at /api/docs (non-production)');
  } else {
    logger.log('Swagger UI disabled in production');
  }

  const port = config.get<number>('port') || 3000;
  await app.listen(port);
  logger.log(
    `Beautijoo API listening on :${port}` +
      (isProd ? '' : '  docs=/api/docs'),
  );
}
bootstrap();
