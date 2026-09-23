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

export type ProfessionalListItem = {
  id: string;
  slug: string;
  title: string;
  bio?: string | null;
  coverImageUrl?: string | null;
  status: string;
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

export type ProfessionalsSearchResponse = {
  items: ProfessionalListItem[];
  meta: { page: number; limit: number; total: number };
};

export type WorkingHourBreak = {
  startTime: string;
  endTime: string;
};

export type WorkingHour = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
  breaks?: WorkingHourBreak[];
};

export type ReviewItem = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  customer?: { profile?: { displayName?: string | null } | null } | null;
};

export type ProfessionalDetail = Omit<
  ProfessionalListItem,
  'professionalServices' | 'locations'
> & {
  locations: { location: LocationSnippet; isPrimary?: boolean }[];
  professionalServices: ProfessionalServiceItem[];
  workingHours: WorkingHour[];
  reviews: ReviewItem[];
};

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  services?: ServiceItem[];
};

export type ServiceItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  category?: ServiceCategory | null;
  categoryId?: string;
};
