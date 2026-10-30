/** Booking-related shared types */

export type BookingItem = {
  id?: string;
  serviceId?: string;
  serviceName?: string;
  durationMin?: number;
  price?: number;
  service?: { id?: string; name?: string } | null;
};

export type BookingListItem = {
  id: string;
  status: string;
  startAt: string;
  endAt?: string | null;
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
    user?: {
      phone?: string | null;
      profile?: { displayName?: string | null } | null;
    };
  };
  location?: {
    id?: string;
    city?: string | null;
    address?: string | null;
  } | null;
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
