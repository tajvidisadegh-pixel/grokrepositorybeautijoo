/** Shapes aligned with backend ProfessionalsService / ServicesService */

export type ProfileSnippet = {
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
};

export type LocationSnippet = {
  id: string;
  name: string;
  address: string;
  city: string;
  province?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  /** exact = public pin; approximate = city/area only */
  precision?: 'exact' | 'approximate' | string | null;
};

export type ServiceSnippet = {
  id: string;
  name: string;
  slug: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type ProfessionalServiceMedia = {
  id: string;
  kind: string;
  publicUrl: string;
  mimeType: string;
  status?: string;
  verifiedAt?: string | null;
  sortOrder?: number;
  title?: string | null;
};

export type ProfessionalServiceAddOn = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  extraDurationMin?: number;
  isActive?: boolean;
};

export type ProfessionalServicePriceRule = {
  id: string;
  label: string;
  price: number;
  isActive?: boolean;
};

export type ProfessionalServiceDurationRule = {
  id: string;
  label: string;
  durationMin: number;
  durationMaxMin?: number | null;
  isActive?: boolean;
};

export type ProfessionalServiceItem = {
  id: string;
  durationMin: number;
  price: number;
  bufferMin?: number;
  description?: string | null;
  isActive?: boolean;
  service: ServiceSnippet;
  mediaAssets?: ProfessionalServiceMedia[];
  addOns?: ProfessionalServiceAddOn[];
  priceRules?: ProfessionalServicePriceRule[];
  durationRules?: ProfessionalServiceDurationRule[];
};

export type WorkingHour = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};

export type ReviewItem = {
  id: string;
  rating: number;
  comment?: string | null;
  customer?: { profile?: ProfileSnippet | null } | null;
};

export type ProfessionalListItem = {
  id: string;
  slug: string;
  title: string;
  bio?: string | null;
  coverImageUrl?: string | null;
  status: string;
  /** Set when admin approves — identity / KYC timestamp */
  verifiedAt?: string | null;
  isFeatured?: boolean;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  /** Present when search used lat/lng/radiusKm */
  distanceKm?: number | null;
  /** True when professional location is approximate (issue #24). */
  distanceApproximate?: boolean;
  user?: { profile?: ProfileSnippet | null } | null;
  locations?: { location: LocationSnippet; isPrimary?: boolean }[];
  /** List may return a subset; detail uses ProfessionalServiceItem[] */
  professionalServices?: Array<{
    id?: string;
    durationMin?: number;
    price?: number;
    bufferMin?: number;
    service: {
      id?: string;
      name: string;
      slug: string;
      category?: { id?: string; name: string; slug?: string } | null;
    };
  }>;
};

export type ProfessionalDetail = ProfessionalListItem & {
  publishedAt?: string | null;
  logoUrl?: string | null;
  socialLinks?: Record<string, string | null> | null;
  workingHours?: WorkingHour[];
  mediaAssets?: Array<{
    id: string;
    kind: string;
    publicUrl?: string | null;
    url?: string | null;
    mimeType?: string;
  }>;
  professionalServices?: ProfessionalServiceItem[];
  reviews?: ReviewItem[];
};

export type SearchProfessionalsResult = {
  items: ProfessionalListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    sort?: string;
    filters?: Record<string, unknown>;
  };
};

export type FilterCategory = {
  id: string;
  name: string;
  slug: string;
};
