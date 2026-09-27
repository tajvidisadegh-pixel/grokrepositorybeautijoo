/** Default platform settings for admin UI (issue #35). Stored as JSON in platform_settings. */
export const PLATFORM_SETTINGS_KEY = 'admin_platform_settings_v1';

export type PlatformSettingsV1 = {
  booking: {
    slotStepMin: number;
    holdMinutes: number;
    cancelWindowHours: number;
    allowSameDay: boolean;
  };
  commission: {
    ratePercent: number;
  };
  professionals: {
    requireManualReview: boolean;
    minServicesToPublish: number;
  };
  reviews: {
    autoPublish: boolean;
    minCommentLength: number;
  };
  search: {
    nearMeDefaultRadiusKm: number;
    featuredBoost: boolean;
  };
  auth: {
    otpTtlSeconds: number;
    maxOtpAttempts: number;
    loginRateLimitPerMinute: number;
  };
  privacy: {
    defaultLocationPrecision: 'exact' | 'approximate';
    showPhoneToCustomer: boolean;
  };
  public: {
    siteName: string;
    supportPhone: string;
    maintenanceMode: boolean;
  };
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsV1 = {
  booking: {
    slotStepMin: 30,
    holdMinutes: 15,
    cancelWindowHours: 24,
    allowSameDay: true,
  },
  commission: {
    ratePercent: 15,
  },
  professionals: {
    requireManualReview: true,
    minServicesToPublish: 1,
  },
  reviews: {
    autoPublish: true,
    minCommentLength: 0,
  },
  search: {
    nearMeDefaultRadiusKm: 10,
    featuredBoost: true,
  },
  auth: {
    otpTtlSeconds: 300,
    maxOtpAttempts: 5,
    loginRateLimitPerMinute: 10,
  },
  privacy: {
    defaultLocationPrecision: 'approximate',
    showPhoneToCustomer: false,
  },
  public: {
    siteName: 'Beautijoo',
    supportPhone: '',
    maintenanceMode: false,
  },
};

export function mergePlatformSettings(
  raw: unknown,
): PlatformSettingsV1 {
  const base = structuredClone(DEFAULT_PLATFORM_SETTINGS);
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  for (const group of Object.keys(base) as (keyof PlatformSettingsV1)[]) {
    const incoming = o[group];
    if (incoming && typeof incoming === 'object') {
      Object.assign(base[group], incoming);
    }
  }
  return base;
}
