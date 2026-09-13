# Beautijoo Frontend Design System

**Source of truth for UI:** Issue #68 mockups + this document.  
Anyone (human or AI) changing the frontend **must** follow these rules so the product stays visually consistent.

---

## 1. Brand identity

| Element | Value |
|--------|--------|
| English name | **BEAUTIJOO** |
| Persian name | **بیوتی‌جو** |
| Tone | Modern, feminine beauty marketplace — soft, clean, trustworthy |
| Direction | **RTL** (Persian primary) |
| Font | **Vazirmatn** (`--font-sans`) |

### Logo

- Component: `frontend/src/components/brand/logo.tsx`
  - `Logo` — mark + wordmark (header/footer)
  - `LogoMark` — icon only (auth pages)
- Mark: rounded square, **full coral gradient only** (no navy inside the mark)
- Gradient: `#ff9a9d` → `#fc7074` → `#e85a5f`
- Letter **B** in white (SVG)
- Wordmark on light background: `BEAUTIJOO` = coral, `بیوتی‌جو` = coral-dark
- Wordmark on navy footer: `BEAUTIJOO` = white, `بیوتی‌جو` = coral-light
- CSS helper: `.logo-mark` in `frontend/src/app/globals.css`

Do **not** reintroduce navy into the logo mark or hardcode old blues like `#0B2C4A`.

---

## 2. Color tokens (Tailwind v4 `@theme`)

Defined in `frontend/src/app/globals.css`:

### Primary — Coral / pink

| Token | Hex | Use |
|-------|-----|-----|
| `coral` | `#fc7074` | Primary CTA, active states, brand accent |
| `coral-dark` | `#e85a5f` | Hover on primary buttons |
| `coral-light` | `#ff9a9d` | Soft accents, footer highlights |
| `coral-soft` | `#fff0f1` | Soft backgrounds, selected chips |

### Secondary — Navy / indigo

| Token | Hex | Use |
|-------|-----|-----|
| `blue` | `#374989` | Secondary text, footer background, titles where needed |
| `blue-dark` | `#2a386b` | Footer bar / darker navy |
| `blue-light` | `#e8ecf7` | Soft navy tint |
| `blue-soft` | `#f2f4fb` | Hover backgrounds (secondary) |

### Neutrals

| Token | Hex | Use |
|-------|-----|-----|
| `white` | `#FFFFFF` | Page / card background |
| `gray` | `#808080` | Body secondary text |
| `gray-muted` | `#9ca3af` | Hints, meta |
| `gray-light` | `#f7f7f8` | Page soft bg, chips |
| `gray-mid` | `#e8e8ea` | Borders soft |
| `gray-dark` | `#4b5563` | Stronger gray text |
| `foreground` | `#1f2937` | Primary text |
| `border` | `#e5e7eb` | Default borders |

### Usage rules

1. **Primary actions** (رزرو، ثبت‌نام، ادامه): `bg-coral` + `hover:bg-coral-dark` + white text.
2. **Links / accents**: `text-coral` / `hover:text-coral-dark`.
3. **Footer**: `bg-blue` with white/coral-light text.
4. **Selected cards / chips**: `border-coral` + `bg-coral-soft`.
5. **Stars / ratings**: amber (`text-amber-500`) is OK for stars only.
6. Prefer theme tokens (`text-coral`, `bg-blue`) over raw hex in components.

---

## 3. Layout & shape

| Rule | Guidance |
|------|----------|
| Max content width | `max-w-6xl` centered |
| Page padding | `px-4 py-10` typical |
| Cards | `rounded-2xl` or `rounded-3xl`, light border, soft shadow |
| Buttons | `rounded-xl` / `rounded-2xl`, height ~ `h-10`–`h-11` |
| Inputs | `rounded-2xl`, focus ring coral |
| Spacing | Generous whitespace; avoid cramped layouts |

---

## 4. Key components

| Area | Path |
|------|------|
| Theme / tokens | `frontend/src/app/globals.css` |
| Logo | `frontend/src/components/brand/logo.tsx` |
| Header | `frontend/src/components/layout/header.tsx` |
| Footer | `frontend/src/components/layout/footer.tsx` |
| Buttons | `frontend/src/components/ui/button.tsx` |
| Cards | `frontend/src/components/ui/card.tsx` |
| Professional cards | `frontend/src/components/professionals/*` |
| Booking wizard | `frontend/src/components/booking/booking-wizard.tsx` |

---

## 5. Pages expected to match brand

- Homepage, search, services, professionals list & detail
- Booking flow
- Login / register / OTP (coral logo mark + titles)
- Customer panel (`/panel`) and professional panel (`/zibagar`) — coral header accents

---

## 6. RTL & copy

- Default `dir="rtl"` on `html`.
- Use Persian UI strings for product surfaces.
- LTR only for phone numbers, times (`dir="ltr"` on those fields).

---

## 7. Do / Don’t

**Do**

- Use `coral` / `blue` tokens from `@theme`
- Keep logo fully coral
- Match soft shadows and large border-radius from mockups
- Keep CI green: `typecheck` + `eslint` + `build`

**Don’t**

- Hardcode `#0B2C4A` or random blues for primary CTAs
- Put navy inside the logo mark
- Break RTL without an explicit LTR need
- Commit secrets or real `NEXT_PUBLIC_*` production values in git

---

## 8. Related

- Design reference: GitHub Issue **#68** (mockup images + color comment)
- Deployment: [DEPLOYMENT.md](../DEPLOYMENT.md)
- App structure: root [README.md](../README.md)
