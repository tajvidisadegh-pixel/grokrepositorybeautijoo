# Jalali dates (#29)

Site-wide display uses:
- `formatDate` / `formatDateTime` from `@/lib/utils` with `fa-IR-u-ca-persian` + `Asia/Tehran`
- `isoToJalaliLabel` / calendar helpers from `@/lib/jalali`

Do not use `toLocaleDateString('fa-IR')` without `u-ca-persian` for calendar dates.
Native `<input type="date">` remains Gregorian for API ISO values (browser limitation).
