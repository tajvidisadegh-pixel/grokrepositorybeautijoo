import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerStorage, getStorageToken } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

/** Always-allow storage so e2e is not blocked by rate limits. Test-only. */
class AllowAllThrottlerStorage {
  async increment(
    _key: string,
    _ttl: number,
    _limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ) {
    return {
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}

export type CreateTestAppOptions = {
  /** When true, keep real Throttler storage so rate-limit behavior can be asserted (#17). */
  enableThrottle?: boolean;
};

export async function createTestApp(
  options: CreateTestAppOptions = {},
): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (!options.enableThrottle) {
    builder
      .overrideProvider(getStorageToken())
      .useClass(AllowAllThrottlerStorage)
      .overrideProvider(ThrottlerStorage)
      .useClass(AllowAllThrottlerStorage);
  }

  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication();
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
  await app.init();
  return app;
}
