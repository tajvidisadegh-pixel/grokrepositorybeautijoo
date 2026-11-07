from pathlib import Path

p = Path("backend/src/bookings/bookings.service.ts")
t = p.read_text()
if "#82.6" in t:
    print("book already #82.6")
else:
    old = """  async reschedule(id: string, userId: string, startAtIso: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    if (b.customerId !== userId) throw new ForbiddenException();
    const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
    if (!allowed.includes(b.status)) throw new BadRequestException('قابل جابجایی نیست');
    const startAt = new Date(startAtIso);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) {
      throw new BadRequestException('زمان نامعتبر');
    }
    const durationMs = b.endAt.getTime() - b.startAt.getTime();
    const endAt = new Date(startAt.getTime() + durationMs);
    const bFull=await this.prisma.booking.findUnique({where:{id},include:{items:{select:{professionalService:{select:{bufferMin:true}}}}}});
    const newBufferMin=this.maxBufferMin(bFull?.items??[]);
    const padMs=Math.max(newBufferMin,180)*60000;
    const candidates=await this.prisma.booking.findMany({where:{professionalId:b.professionalId,id:{not:id},status:{in:[BookingStatus.pending,BookingStatus.confirmed]},startAt:{lt:new Date(endAt.getTime()+padMs)},endAt:{gt:new Date(startAt.getTime()-padMs)}},include:{items:{select:{professionalService:{select:{bufferMin:true}}}}}});
    for(const e of candidates){ if(this.bookingRangesConflict(startAt,endAt,newBufferMin,e.startAt,e.endAt,this.maxBufferMin(e.items))) throw new ConflictException('این بازه زمانی قبلاً رزرو شده است'); }
    return this.prisma.booking.update({ where: { id }, data: { startAt, endAt } });
  }"""
    new = """  async reschedule(id: string, userId: string, startAtIso: string) {
    // #82.6 — transactional reschedule with overlap / timeOff / manual / lead-time locks
    const startAt = new Date(startAtIso);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) {
      throw new BadRequestException('زمان نامعتبر');
    }
    if (startAt.getTime() < Date.now() + 60 * 60 * 1000) {
      throw new BadRequestException('زمان انتخاب‌شده کمتر از حداقل فاصله مجاز است');
    }
    return this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.findUnique({
        where: { id },
        include: { items: { select: { professionalService: { select: { bufferMin: true } } } } },
      });
      if (!b) throw new NotFoundException();
      if (b.customerId !== userId) throw new ForbiddenException();
      const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (!allowed.includes(b.status)) throw new BadRequestException('قابل جابجایی نیست');
      const durationMs = b.endAt.getTime() - b.startAt.getTime();
      const endAt = new Date(startAt.getTime() + durationMs);
      const newBufferMin = this.maxBufferMin(b.items ?? []);
      const padMs = Math.max(newBufferMin, 180) * 60000;
      const candidates = await tx.booking.findMany({
        where: {
          professionalId: b.professionalId,
          id: { not: id },
          status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
          startAt: { lt: new Date(endAt.getTime() + padMs) },
          endAt: { gt: new Date(startAt.getTime() - padMs) },
        },
        include: { items: { select: { professionalService: { select: { bufferMin: true } } } } },
      });
      for (const e of candidates) {
        if (this.bookingRangesConflict(startAt, endAt, newBufferMin, e.startAt, e.endAt, this.maxBufferMin(e.items))) {
          throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');
        }
      }
      if (await tx.timeOff.count({ where: { professionalId: b.professionalId, startAt: { lt: endAt }, endAt: { gt: startAt } } })) {
        throw new ConflictException('در این بازه زمانی زیباگر در مرخصی/تعطیلی است');
      }
      if (await tx.manualReservation.count({ where: { professionalId: b.professionalId, startAt: { lt: endAt }, endAt: { gt: startAt } } })) {
        throw new ConflictException('این بازه توسط رزرو دستی مسدود است');
      }
      return tx.booking.update({ where: { id }, data: { startAt, endAt } });
    });
  }"""
    if old not in t:
        print("WARNING reschedule anchor missing")
    else:
        t = t.replace(old, new, 1)
        p.write_text(t)
        print("#82.6 applied")
