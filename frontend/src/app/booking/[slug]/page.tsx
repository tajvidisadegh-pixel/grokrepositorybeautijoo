import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getProfessionalBySlug,
  PublicApiError,
} from '@/lib/public-api';
import { BookingWizard } from '@/components/booking/booking-wizard';
import { siteName } from '@/lib/seo';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    serviceId?: string;
    date?: string;
    slot?: string;
    locationId?: string;
    addOnIds?: string;
    priceRuleId?: string;
    durationRuleId?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const pro = await getProfessionalBySlug(slug);
    const name = pro.user?.profile?.displayName || pro.title;
    return {
      title: `رزرو نوبت — ${name}`,
      description: `رزرو آنلاین با ${name} در ${siteName()}`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: 'رزرو نوبت', robots: { index: false } };
  }
}


type AttrGroupLite = {
  id: string;
  name: string;
  required?: boolean;
  options?: Array<{
    id: string;
    label: string;
    suggestedPriceDelta?: number;
    suggestedDurationDeltaMin?: number;
  }>;
};

type ProServiceRow = {
  id: string;
  durationMin: number;
  bufferMin?: number | null;
  price: number;
  pricingMode?: string | null;
  depositAmount?: number | null;
  estimateMinPrice?: number | null;
  estimateMaxPrice?: number | null;
  optionDeltas?: Record<string, { priceDelta?: number; durationDeltaMin?: number; active?: boolean }> | null;
  service: {
    id: string;
    name: string;
    category?: { name?: string } | null;
    attributeGroups?: AttrGroupLite[];
  };
  addOns?: Array<{ id: string; name: string; price: number; extraDurationMin?: number }>;
  priceRules?: Array<{ id: string; label: string; price: number }>;
  durationRules?: Array<{ id: string; label: string; durationMin: number }>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  let pro;
  try {
    pro = await getProfessionalBySlug(slug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  const services = ((pro.professionalServices || []) as ProServiceRow[]).map((ps) => ({
    professionalServiceId: ps.id,
    serviceId: ps.service.id,
    name: ps.service.name,
    durationMin: ps.durationMin,
    bufferMin: ps.bufferMin ?? 0,
    price: ps.price,
    categoryName: ps.service.category?.name,
    pricingMode: (ps.pricingMode as string) || 'fixed',
    depositAmount: ps.depositAmount ?? null,
    estimateMinPrice: ps.estimateMinPrice ?? null,
    estimateMaxPrice: ps.estimateMaxPrice ?? null,
    optionDeltas: ps.optionDeltas || null,
    attributeGroups: (ps.service?.attributeGroups || []).map((g) => ({
      id: g.id,
      name: g.name,
      required: g.required !== false,
      options: (g.options || []).map((o) => ({
        id: o.id,
        label: o.label,
        suggestedPriceDelta: o.suggestedPriceDelta ?? 0,
        suggestedDurationDeltaMin: o.suggestedDurationDeltaMin ?? 0,
      })),
    })),
    addOns: (ps.addOns || []).map((a) => ({
      id: a.id,
      name: a.name,
      price: a.price,
      extraDurationMin: a.extraDurationMin || 0,
    })),
    priceRules: (ps.priceRules || []).map((r) => ({
      id: r.id,
      label: r.label,
      price: r.price,
    })),
    durationRules: (ps.durationRules || []).map((r) => ({
      id: r.id,
      label: r.label,
      durationMin: r.durationMin,
    })),
  }));

  const locations = (pro.locations || []).map((pl) => ({
    id: pl.location.id,
    name: pl.location.name,
    city: pl.location.city,
    address: pl.location.address,
    isPrimary: pl.isPrimary,
  }));

  const initialAddOnIds = (sp.addOnIds || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <BookingWizard
      professional={{
        id: pro.id,
        slug: pro.slug,
        name: pro.user?.profile?.displayName || pro.title,
        title: pro.title,
      }}
      services={services}
      locations={locations}
      initialServiceId={sp.serviceId}
      initialDate={sp.date}
      initialSlot={sp.slot}
      initialLocationId={sp.locationId}
      initialAddOnIds={initialAddOnIds}
      initialPriceRuleId={sp.priceRuleId}
      initialDurationRuleId={sp.durationRuleId}
    />
  );
}
