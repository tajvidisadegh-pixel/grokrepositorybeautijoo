/**
 * قالب استاندارد کاتالوگ (#60)
 * فقط ابعادی که روی قیمت اثر دارند.
 * ناخن: قد کوتاه/بلند نیست — مواد + سطح طراحی.
 */

export type PriceDim = {
  key: string;
  label: string;
  options: string[];
};

export type CatalogVariant = {
  name: string;
  /** dimensions that apply to this variant (keys from family.dims) */
  dimKeys?: string[];
};

export type CatalogFamily = {
  name: string;
  dims: PriceDim[];
  variants: CatalogVariant[];
};

export type CatalogSpecialty = {
  name: string;
  slug: string;
  families: CatalogFamily[];
};

export const CATALOG_TEMPLATE: CatalogSpecialty[] = [
  {
    name: 'مو',
    slug: 'hair',
    families: [
      {
        name: 'کوتاهی و اصلاح',
        dims: [{ key: 'length', label: 'قد مو', options: ['کوتاه', 'متوسط', 'بلند'] }],
        variants: [
          { name: 'کوتاهی مو زنانه' },
          { name: 'کوتاهی مو مردانه', dimKeys: [] },
          { name: 'کوتاهی کودک', dimKeys: [] },
          { name: 'چتری و اصلاح پشته' },
          { name: 'کوتاهی لایه‌ای / ساقه‌ای' },
        ],
      },
      {
        name: 'رنگ',
        dims: [{ key: 'length', label: 'قد مو', options: ['کوتاه', 'متوسط', 'بلند'] }],
        variants: [
          { name: 'رنگ ریشه' },
          { name: 'رنگ کامل' },
          { name: 'رنگ فانتزی' },
          { name: 'دکلره پایه' },
          { name: 'تونر / شینیگ' },
        ],
      },
      {
        name: 'لایت و تکنیک',
        dims: [
          { key: 'length', label: 'قد مو', options: ['کوتاه', 'متوسط', 'بلند'] },
          { key: 'foils', label: 'تعداد فویل', options: ['تا ۲۰', '۲۰ تا ۴۰', 'بیش از ۴۰'] },
        ],
        variants: [
          { name: 'هایلایت' },
          { name: 'بالیاژ' },
          { name: 'امبره' },
          { name: 'سامبره' },
          { name: 'کلاهی / شیدو' },
          { name: 'بیبی‌لایت' },
        ],
      },
      {
        name: 'اکستنشن',
        dims: [{ key: 'method', label: 'روش', options: ['چسبی', 'حلقه‌ای', 'کراتینه', 'کلیپسی'] }],
        variants: [
          { name: 'نصب اکستنشن' },
          { name: 'شارژ / ترمیم اکستنشن' },
          { name: 'برداشتن اکستنشن' },
        ],
      },
      {
        name: 'احیا و مراقبت',
        dims: [{ key: 'length', label: 'قد مو', options: ['کوتاه', 'متوسط', 'بلند'] }],
        variants: [
          { name: 'کراتین' },
          { name: 'بوتاکس مو' },
          { name: 'پروتئین‌تراپی' },
          { name: 'ماسک و درمان عمقی' },
        ],
      },
      {
        name: 'فر و بافت',
        dims: [{ key: 'length', label: 'قد مو', options: ['کوتاه', 'متوسط', 'بلند'] }],
        variants: [
          { name: 'فر دائم' },
          { name: 'بافت' },
          { name: 'باز کردن بافت' },
        ],
      },
      {
        name: 'شینیون و براشینگ',
        dims: [{ key: 'level', label: 'سطح کار', options: ['ساده', 'مجلسی', 'عروس'] }],
        variants: [
          { name: 'براشینگ' },
          { name: 'شینیون' },
          { name: 'اتو / بابلیس' },
        ],
      },
    ],
  },
  {
    name: 'ناخن',
    slug: 'nails',
    families: [
      {
        name: 'مانیکور و پدیکور',
        dims: [],
        variants: [
          { name: 'مانیکور' },
          { name: 'پدیکور' },
          { name: 'مانیکور آقایان' },
        ],
      },
      {
        name: 'کاشت و مواد',
        dims: [
          { key: 'material', label: 'مواد', options: ['ژلیش / طبیعی', 'ژل', 'پودر', 'پلی‌ژل'] },
        ],
        variants: [
          { name: 'کاشت / کاور' },
          { name: 'ترمیم' },
          { name: 'برداشتن کاشت' },
        ],
      },
      {
        name: 'لاک و طراحی',
        dims: [
          { key: 'design', label: 'سطح طراحی', options: ['ساده', 'معمولی', 'خاص'] },
        ],
        variants: [
          { name: 'لاک ژل' },
          { name: 'فرنچ' },
          { name: 'طراحی ناخن' },
        ],
      },
    ],
  },
  {
    name: 'پوست',
    slug: 'skin',
    families: [
      {
        name: 'پاکسازی و فیشیال',
        dims: [{ key: 'level', label: 'سطح', options: ['سطحی', 'عمقی'] }],
        variants: [
          { name: 'پاکسازی پوست' },
          { name: 'فیشیال آبرسان' },
          { name: 'فیشیال ضدلک' },
          { name: 'ماسک تخصصی' },
        ],
      },
    ],
  },
  {
    name: 'آرایش',
    slug: 'makeup',
    families: [
      {
        name: 'آرایش صورت',
        dims: [{ key: 'level', label: 'سطح', options: ['روزانه', 'مجلسی', 'عروس'] }],
        variants: [
          { name: 'آرایش صورت' },
          { name: 'آرایش عروس' },
          { name: 'آزمون آرایش عروس' },
        ],
      },
    ],
  },
  {
    name: 'ابرو',
    slug: 'brows',
    families: [
      {
        name: 'ابرو',
        dims: [],
        variants: [
          { name: 'اصلاح ابرو' },
          { name: 'رنگ ابرو' },
          { name: 'لمینت ابرو' },
        ],
      },
    ],
  },
  {
    name: 'مژه',
    slug: 'lashes',
    families: [
      {
        name: 'مژه',
        dims: [{ key: 'style', label: 'سبک', options: ['کلاسیک', 'والیوم', 'هیبرید'] }],
        variants: [
          { name: 'لیفت مژه' },
          { name: 'اکستنشن مژه' },
          { name: 'شارژ اکستنشن' },
          { name: 'برداشتن اکستنشن' },
        ],
      },
    ],
  },
  {
    name: 'اپیلاسیون',
    slug: 'waxing',
    families: [
      {
        name: 'حذف مو',
        dims: [{ key: 'method', label: 'روش', options: ['شمع', 'بند'] }],
        variants: [
          { name: 'صورت' },
          { name: 'زیربغل' },
          { name: 'دست' },
          { name: 'نیمه‌پا' },
          { name: 'تمام‌پا' },
        ],
      },
    ],
  },
];

/** Build price-rule labels for a variant from family dims */
export function matrixLabels(
  family: CatalogFamily,
  variant: CatalogVariant,
): string[] {
  const dims = family.dims.filter((d) =>
    variant.dimKeys ? variant.dimKeys.includes(d.key) : true,
  );
  if (dims.length === 0) return ['قیمت پایه'];
  if (dims.length === 1) return dims[0].options;
  // 2 dims: cartesian product joined with ·
  const [a, b] = dims;
  const out: string[] = [];
  for (const oa of a.options) for (const ob of b.options) out.push(`${oa} · ${ob}`);
  return out;
}

export function minPriceFromRules(rules: { price: number; isActive?: boolean }[]): number | null {
  const active = rules.filter((r) => r.isActive !== false && r.price > 0);
  if (!active.length) return null;
  return Math.min(...active.map((r) => r.price));
}
