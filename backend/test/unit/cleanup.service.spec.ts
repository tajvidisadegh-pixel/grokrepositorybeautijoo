import { CleanupService } from '../../src/cleanup/cleanup.service';

describe('CleanupService (unit)', () => {
  function makeService(overrides: {
    otp?: number;
    refresh?: number;
    session?: number;
    booking?: number;
    media?: Array<{ id: string; storageKey: string | null }>;
  }) {
    const prisma: any = {
      otpCode: {
        deleteMany: jest.fn().mockResolvedValue({ count: overrides.otp ?? 0 }),
      },
      refreshToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: overrides.refresh ?? 0 }),
      },
      session: {
        deleteMany: jest.fn().mockResolvedValue({ count: overrides.session ?? 0 }),
      },
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: overrides.booking ?? 0 }),
      },
      mediaAsset: {
        findMany: jest.fn().mockResolvedValue(overrides.media ?? []),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const config: any = {
      get: (k: string) => (k === 'CLEANUP_ENABLED' ? 'true' : undefined),
    };
    const storage = {
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const jobLease = {
      withLease: jest.fn((_name: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
      tryAcquire: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new CleanupService(prisma, config, storage as any, jobLease as any);
    return { svc, prisma, storage, jobLease };
  }

  it('runAll aggregates counts', async () => {
    const { svc } = makeService({
      otp: 3,
      refresh: 2,
      session: 1,
      booking: 4,
      media: [],
    });
    const stats = await svc.runAll();
    expect(stats).toEqual({
      otpsDeleted: 3,
      refreshTokensDeleted: 2,
      sessionsDeleted: 1,
      bookingsCompleted: 4,
      mediaOrphansDeleted: 0,
    });
  });

  it('purgeOrphanDraftMedia deletes storage then row', async () => {
    const { svc, prisma, storage } = makeService({
      media: [
        { id: 'm1', storageKey: 'key1' },
        { id: 'm2', storageKey: null },
      ],
    });
    const n = await svc.purgeOrphanDraftMedia();
    expect(n).toBe(2);
    expect(storage.delete).toHaveBeenCalledWith('key1');
    expect(prisma.mediaAsset.delete).toHaveBeenCalledTimes(2);
  });

  it('completePastBookings updates pending/confirmed past endAt to completed', async () => {
    const { svc, prisma } = makeService({ booking: 5 });
    const n = await svc.completePastBookings();
    expect(n).toBe(5);
    expect(prisma.booking.updateMany).toHaveBeenCalled();
    const arg = prisma.booking.updateMany.mock.calls[0][0];
    expect(arg.data.status).toBe('completed');
  });
});
