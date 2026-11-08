import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { apiVersionHeaders } from './common/api-version.middleware';
import { API_VERSION_LABEL, APP_VERSION } from './common/api-version';
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

    // #82.14 — no directory listing; public portfolio media only
    app.useStaticAssets(uploadsAbs, {
      prefix: '/uploads/',
      index: false,
      setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    });
    logger.log(`Static /uploads → ${uploadsAbs} (#82.14 public media only)`);
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
    exposedHeaders: ['X-API-Version', 'X-App-Version', 'X-Correlation-Id'],
  });
  logger.log(`CORS origins (${isProd ? 'prod' : 'dev'}): ${corsOrigins.join(', ')}`);

  // #82.17 — production must not boot with mock SMS/payment (fail-fast, not warn-only)
  const smsProvider = (
    process.env.SMS_PROVIDER ||
    config.get<string>('smsProvider') ||
    'mock'
  )
    .trim()
    .toLowerCase();
  const allowMockSms =
    (process.env.ALLOW_MOCK_SMS || '').toLowerCase() === 'true' ||
    config.get<boolean>('allowMockSms') === true;
  if (isProd && (smsProvider === 'mock' || smsProvider === '' || smsProvider === 'none')) {
    if (!allowMockSms) {
      throw new Error(
        'FATAL: SMS_PROVIDER is mock/empty in production — OTP would not reach real phones. ' +
          'Set SMS_PROVIDER=smsir with SMSIR_API_KEY and SMSIR_OTP_TEMPLATE_ID, ' +
          'or set ALLOW_MOCK_SMS=true only for emergency diagnostics.',
      );
    }
    logger.warn(
      'ALLOW_MOCK_SMS=true — mock/empty SMS allowed in production (diagnostics only). OTP will not be delivered to real phones.',
    );
  }

  const paymentProvider = (
    process.env.PAYMENT_PROVIDER ||
    config.get<string>('paymentProvider') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (isProd && paymentProvider === 'mock') {
    throw new Error(
      'FATAL: PAYMENT_PROVIDER=mock is forbidden in production (fake PAID risk). ' +
        'Set PAYMENT_PROVIDER=zarinpal (live gateway) or disabled (online payment off).',
    );
  }
  if (
    isProd &&
    (!paymentProvider ||
      paymentProvider === 'disabled' ||
      paymentProvider === 'none' ||
      paymentProvider === 'off')
  ) {
    logger.warn(
      'PAYMENT_PROVIDER is empty/disabled in production — online payments are off (safe). Set zarinpal when ready.',
    );
  }

  app.use(apiVersionHeaders);
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

  {
    const swagger = new DocumentBuilder()
      .setTitle('Beautijoo API')
      .setDescription(
        'Persian RTL beauty marketplace — زیباگر booking platform. ' +
          'Versioning: path /api/v1 · headers X-API-Version / X-App-Version. ' +
          'See docs/API_VERSIONING.md.',
      )
      .setVersion(API_VERSION_LABEL)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    if (!isProd) {
      SwaggerModule.setup('api/docs', app, document);
      logger.log('Swagger UI enabled at /api/docs (non-production)');
      // #82.14 — OpenAPI JSON only outside production
      const http = app.getHttpAdapter().getInstance();
      if (http && typeof http.get === 'function') {
        http.get(
          '/api/v1/openapi.json',
          (_req: unknown, res: { type: (t: string) => void; json: (b: unknown) => void }) => {
            res.type('application/json');
            res.json(document);
          },
        );
        logger.log(
          `OpenAPI JSON at /api/v1/openapi.json (api=${API_VERSION_LABEL}, app=${APP_VERSION})`,
        );
      }
    } else {
      logger.log('Swagger UI and OpenAPI JSON disabled in production (#82.14)');
    }
  }

  const port = config.get<number>('port') || 3000;
  await app.listen(port);
  logger.log(
    `Beautijoo API listening on :${port}` +
      (isProd ? '' : '  docs=/api/docs'),
  );
}
bootstrap();
