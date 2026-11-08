# Backend build log

exit=1

```

> beautijoo-backend@3.0.0 build
> prisma generate --schema=./prisma/schema.prisma && nest build

Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v5.22.0) to ./../node_modules/@prisma/client in 420ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Want to react to database changes in your app as they happen? Discover how with Pulse: https://pris.ly/tip-1-pulse

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 8.0.0-rc.33                 │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
[96msrc/availability/availability.service.ts[0m:[93m4[0m:[93m39[0m - [91merror[0m[90m TS2305: [0mModule '"../common/timezone"' has no exported member 'tehranWeekdaySun0'.

[7m4[0m import { TEHRAN_TZ, tehranLocalToUtc, tehranWeekdaySun0 } from '../common/timezone';
[7m [0m [91m                                      ~~~~~~~~~~~~~~~~~[0m
[96msrc/availability/availability.service.ts[0m:[93m38[0m:[93m37[0m - [91merror[0m[90m TS2551: [0mProperty 'workingHours' does not exist on type 'PrismaService'. Did you mean 'workingHour'?

[7m38[0m     const hours = await this.prisma.workingHours.findMany({
[7m  [0m [91m                                    ~~~~~~~~~~~~[0m

  [96m../node_modules/.prisma/client/index.d.ts[0m:[93m677[0m:[93m7[0m
    [7m677[0m   get workingHour(): Prisma.WorkingHourDelegate<ExtArgs>;
    [7m   [0m [96m      ~~~~~~~~~~~[0m
    'workingHour' is declared here.
[96msrc/availability/availability.service.ts[0m:[93m72[0m:[93m19[0m - [91merror[0m[90m TS2339: [0mProperty 'breakTime' does not exist on type 'PrismaService'.

[7m72[0m       this.prisma.breakTime.findMany({
[7m  [0m [91m                  ~~~~~~~~~[0m
[96msrc/availability/availability.service.ts[0m:[93m98[0m:[93m24[0m - [91merror[0m[90m TS7006: [0mParameter 'b' implicitly has an 'any' type.

[7m98[0m       ...bookings.map((b) => ({
[7m  [0m [91m                       ~[0m
[96msrc/availability/availability.service.ts[0m:[93m102[0m:[93m24[0m - [91merror[0m[90m TS7006: [0mParameter 'b' implicitly has an 'any' type.

[7m102[0m       ...timeOffs.map((b) => ({
[7m   [0m [91m                       ~[0m
[96msrc/availability/availability.service.ts[0m:[93m106[0m:[93m23[0m - [91merror[0m[90m TS7006: [0mParameter 'b' implicitly has an 'any' type.

[7m106[0m       ...manuals.map((b) => ({
[7m   [0m [91m                      ~[0m
[96msrc/availability/availability.service.ts[0m:[93m115[0m:[93m39[0m - [91merror[0m[90m TS7006: [0mParameter 'b' implicitly has an 'any' type.

[7m115[0m       const breakRanges = breaks.map((b) => ({
[7m   [0m [91m                                      ~[0m
[96msrc/availability/availability.service.ts[0m:[93m125[0m:[93m43[0m - [91merror[0m[90m TS7006: [0mParameter 'b' implicitly has an 'any' type.

[7m125[0m         const inBreak = breakRanges.some((b) => t < b.end && slotEnd > b.start);
[7m   [0m [91m                                          ~[0m
[96msrc/bookings/bookings.service.ts[0m:[93m489[0m:[93m68[0m - [91merror[0m[90m TS2345: [0mArgument of type 'BookingStatus' is not assignable to parameter of type '"pending" | "confirmed"'.
  Type '"rejected"' is not assignable to type '"pending" | "confirmed"'.

[7m489[0m     if (![BookingStatus.pending, BookingStatus.confirmed].includes(existing.status)) {
[7m   [0m [91m                                                                   ~~~~~~~~~~~~~~~[0m
[96msrc/bookings/bookings.service.ts[0m:[93m649[0m:[93m70[0m - [91merror[0m[90m TS2345: [0mArgument of type 'BookingStatus' is not assignable to parameter of type '"pending" | "confirmed"'.
  Type '"rejected"' is not assignable to type '"pending" | "confirmed"'.

[7m649[0m       if (![BookingStatus.pending, BookingStatus.confirmed].includes(b.status)) {
[7m   [0m [91m                                                                     ~~~~~~~~[0m

Found 10 error(s).

npm error Lifecycle script `build` failed with error:
npm error code 1
npm error path /home/runner/work/grokrepositorybeautijoo/grokrepositorybeautijoo/backend
npm error workspace beautijoo-backend@3.0.0
npm error location /home/runner/work/grokrepositorybeautijoo/grokrepositorybeautijoo/backend
npm error command failed
npm error command sh -c prisma generate --schema=./prisma/schema.prisma && nest build
```
