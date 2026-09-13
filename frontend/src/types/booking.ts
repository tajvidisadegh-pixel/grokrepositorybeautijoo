export type AvailabilitySlot = {
  start: string; // HH:MM
  end: string;
  /** false = booked / blocked / break — shown but not selectable (#69) */
  available?: boolean;
};

export type AvailabilityResponse = {
  date: string;
  professionalId: string;
  durationMin: number;
  slots: AvailabilitySlot[];
  timezone?: string;
};

export type CreateBookingPayload = {
  professionalId: string;
  serviceIds: string[];
  startAt: string; // ISO
  locationId?: string;
  notes?: string;
  addOnIds?: string[];
  priceRuleId?: string;
  durationRuleId?: string;
};

export type BookingItem = {
  id: string;
  serviceId: string;
  durationMin: number;
  price: number;
  service?: { id: string; name: string; slug?: string };
};

export type BookingRecord = {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  totalPrice: number;
  notes?: string | null;
  professionalId: string;
  customerId: string;
  locationId?: string | null;
  items?: BookingItem[];
  professional?: {
    id: string;
    slug?: string;
    title?: string;
    user?: { profile?: { displayName?: string | null } | null };
  };
  payment?: {
    id: string;
    status: string;
    amount?: number;
  } | null;
};

/** Draft kept across login redirect */
export type BookingDraft = {
  professionalId: string;
  professionalSlug: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  durationMin: number;
  price: number;
  locationId?: string;
  date: string; // YYYY-MM-DD
  slotStart: string; // HH:MM
  notes?: string;
  addOnIds?: string[];
  priceRuleId?: string;
  durationRuleId?: string;
};
