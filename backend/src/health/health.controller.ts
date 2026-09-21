import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsRegistry } from '../observability/metrics.registry';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.provider';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsRegistry,
    @Optional() @Inject(STORAGE_PROVIDER) private readonly storage?: StorageProvider,
  ) {}

  /** Liveness + dependency probes (not rate-limited). */
  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    let storage: 'up' | 'down' | 'unconfigured' = 'unconfigured';
    try {
      if (
        this.storage &&
        typeof (this.storage as { healthCheck?: () => Promise<boolean> }).healthCheck ===
          'function'
      ) {
        const ok = await (this.storage as { healthCheck: () => Promise<boolean> }).healthCheck();
        storage = ok ? 'up' : 'down';
      } else if (this.storage) {
        // Provider exists — report configured without remote probe
        storage = 'up';
      }
    } catch {
      storage = 'down';
    }

    const ok = database === 'up';
    return {
      status: ok ? (storage === 'down' ? 'degraded' : 'ok') : 'degraded',
      database,
      storage,
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Baseline process metrics (JSON). Public for ops probes; no secrets. */
  @Public()
  @SkipThrottle()
  @Get('metrics')
  metricsEndpoint() {
    const snap = this.metrics.snapshot();
    const avgLatencyMs =
      snap.httpDurationMsCount > 0
        ? Math.round(snap.httpDurationMsSum / snap.httpDurationMsCount)
        : 0;
    return {
      ...snap,
      httpDurationMsAvg: avgLatencyMs,
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
