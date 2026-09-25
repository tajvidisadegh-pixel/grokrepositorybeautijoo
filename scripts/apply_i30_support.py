#!/usr/bin/env python3
"""Apply remaining issue #30: Support tickets (backend + frontend) + keep specialties selection-only.
Additive only. Does not touch SpecialtyView free-text (already removed).
"""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] if (Path(__file__).parent.name == "scripts") else Path.cwd()

def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)}")

def patch_schema() -> None:
    schema = ROOT / "backend/prisma/schema.prisma"
    text = schema.read_text(encoding="utf-8")
    if "model SupportTicket" in text:
        print("  schema: SupportTicket already present")
        return

    # Add relations on User
    if "supportTickets" not in text:
        text = text.replace(
            "  auditLogs            AuditLog[]      @relation(\"AuditActor\")\n",
            "  auditLogs            AuditLog[]      @relation(\"AuditActor\")\n"
            "  supportTickets       SupportTicket[]\n"
            "  supportMessages      SupportTicketMessage[]\n",
        )

    # Append models before end of file
    models = '''
model SupportTicket {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  subject   String   @db.VarChar(200)
  status    String   @default("open") @db.VarChar(20)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  SupportTicketMessage[]

  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("support_tickets")
}

model SupportTicketMessage {
  id        String   @id @default(uuid()) @db.Uuid
  ticketId  String   @map("ticket_id") @db.Uuid
  senderId  String   @map("sender_id") @db.Uuid
  body      String   @db.Text
  isStaff   Boolean  @default(false) @map("is_staff")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  ticket    SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  sender    User     @relation(fields: [senderId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@index([createdAt])
  @@map("support_ticket_messages")
}
'''
    if not text.endswith("\n"):
        text += "\n"
    text += models
    schema.write_text(text, encoding="utf-8")
    print("  schema: added SupportTicket + SupportTicketMessage")

def write_backend() -> None:
    # support.module.ts
    write(ROOT / "backend/src/support/support.module.ts", '''import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';

@Module({
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
''')

    # support.service.ts
    write(ROOT / "backend/src/support/support.service.ts", '''import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, page = 1, limit = 30) {
    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(limit || 30, 1), 50);
    const skip = (safePage - 1) * safeLimit;
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { body: true, createdAt: true, isStaff: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return {
      items: items.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messageCount: t._count.messages,
        lastPreview: t.messages[0]?.body?.slice(0, 120) ?? null,
      })),
      meta: { page: safePage, limit: safeLimit, total },
    };
  }

  async listAll(page = 1, limit = 40, status?: string) {
    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(limit || 40, 1), 80);
    const skip = (safePage - 1) * safeLimit;
    const where: { status?: string } = {};
    if (status && status !== 'all') where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              accountType: true,
              profile: { select: { displayName: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { body: true, createdAt: true, isStaff: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return {
      items: items.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messageCount: t._count.messages,
        lastPreview: t.messages[0]?.body?.slice(0, 120) ?? null,
        user: {
          id: t.user.id,
          phone: t.user.phone,
          accountType: t.user.accountType,
          displayName: t.user.profile?.displayName ?? null,
        },
      })),
      meta: { page: safePage, limit: safeLimit, total },
    };
  }

  async getOne(ticketId: string, userId: string, isStaff: boolean) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            accountType: true,
            profile: { select: { displayName: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                phone: true,
                profile: { select: { displayName: true } },
              },
            },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');
    if (!isStaff && ticket.userId !== userId) {
      throw new ForbiddenException('دسترسی ندارید');
    }
    return ticket;
  }

  async createTicket(userId: string, subject: string, body: string) {
    const sub = (subject || '').trim().slice(0, 200);
    const msg = (body || '').trim();
    if (sub.length < 3) throw new ForbiddenException('موضوع حداقل ۳ کاراکتر باشد');
    if (msg.length < 2) throw new ForbiddenException('پیام حداقل ۲ کاراکتر باشد');
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        subject: sub,
        status: 'open',
        messages: {
          create: {
            senderId: userId,
            body: msg,
            isStaff: false,
          },
        },
      },
      include: {
        messages: true,
      },
    });
    return ticket;
  }

  async addMessage(
    ticketId: string,
    senderId: string,
    body: string,
    isStaff: boolean,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');
    if (!isStaff && ticket.userId !== senderId) {
      throw new ForbiddenException('دسترسی ندارید');
    }
    const msg = (body || '').trim();
    if (msg.length < 1) throw new ForbiddenException('پیام خالی است');
    const message = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        senderId,
        body: msg,
        isStaff,
      },
    });
    const newStatus = isStaff ? 'answered' : 'open';
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: newStatus, updatedAt: new Date() },
    });
    return message;
  }

  async setStatus(ticketId: string, status: string) {
    const allowed = ['open', 'answered', 'closed'];
    if (!allowed.includes(status)) {
      throw new ForbiddenException('وضعیت نامعتبر');
    }
    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });
    return ticket;
  }
}
''')

    # support.controller.ts
    write(ROOT / "backend/src/support/support.controller.ts", '''import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  /** Zibagar / customer: my tickets */
  @Get('tickets')
  listMine(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
  ) {
    return this.service.listMine(userId, page ? parseInt(page, 10) : 1);
  }

  /** Admin: all tickets */
  @Get('tickets/all')
  @Roles('admin', 'SUPER_ADMIN')
  listAll(
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listAll(
      page ? parseInt(page, 10) : 1,
      40,
      status,
    );
  }

  @Get('tickets/:id')
  getOne(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[] | undefined,
    @Param('id') id: string,
  ) {
    const isStaff = Array.isArray(roles) && (
      roles.includes('admin') || roles.includes('SUPER_ADMIN')
    );
    return this.service.getOne(id, userId, !!isStaff);
  }

  @Post('tickets')
  create(
    @CurrentUser('id') userId: string,
    @Body() body: { subject?: string; body?: string },
  ) {
    return this.service.createTicket(
      userId,
      body?.subject ?? '',
      body?.body ?? '',
    );
  }

  @Post('tickets/:id/messages')
  addMessage(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[] | undefined,
    @Param('id') id: string,
    @Body() body: { body?: string },
  ) {
    const isStaff = Array.isArray(roles) && (
      roles.includes('admin') || roles.includes('SUPER_ADMIN')
    );
    return this.service.addMessage(id, userId, body?.body ?? '', !!isStaff);
  }

  @Patch('tickets/:id/status')
  @Roles('admin', 'SUPER_ADMIN')
  setStatus(
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.service.setStatus(id, body?.status ?? 'open');
  }
}
''')

def patch_app_module() -> None:
    path = ROOT / "backend/src/app.module.ts"
    text = path.read_text(encoding="utf-8")
    if "SupportModule" in text:
        print("  app.module: SupportModule already imported")
        return
    text = text.replace(
        "import { JobsModule } from './jobs/jobs.module';\n",
        "import { JobsModule } from './jobs/jobs.module';\n"
        "import { SupportModule } from './support/support.module';\n",
    )
    text = text.replace(
        "    RemindersModule,\n",
        "    RemindersModule,\n"
        "    SupportModule,\n",
    )
    path.write_text(text, encoding="utf-8")
    print("  app.module: imported SupportModule")

def write_frontend_pages() -> None:
    # Zibagar support page
    write(ROOT / "frontend/src/app/zibagar/support/page.tsx", '''\'use client\';
import { useCallback, useEffect, useState } from \'react\';
import { Card } from \'@/components/ui/card\';
import { Button } from \'@/components/ui/button\';
import { Input } from \'@/components/ui/input\';
import { PanelLoading, PanelError, PanelEmpty } from \'@/components/panel/state-blocks\';
import { apiClient } from \'@/lib/api\';
import { friendlyApiError } from \'@/lib/api-errors\';
import { formatDate } from \'@/lib/utils\';

type TicketListItem = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastPreview?: string | null;
};

type TicketDetail = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  messages: Array<{
    id: string;
    body: string;
    isStaff: boolean;
    createdAt: string;
    sender?: { profile?: { displayName?: string | null } | null; phone?: string | null } | null;
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  open: \'باز\',
  answered: \'پاسخ داده شده\',
  closed: \'بسته\',
};

export default function ZibagarSupportPage() {
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState(\'\');
  const [body, setBody] = useState(\'\');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState(\'\');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items?: TicketListItem[] }>(\'/support/tickets?page=1\');
      setItems(res.items || []);
    } catch (e) {
      setItems([]);
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openTicket(id: string) {
    setSelectedId(id);
    setDetail(null);
    setReply(\'\');
    setMsg(null);
    try {
      const d = await apiClient.get<TicketDetail>(\`/support/tickets/\${id}\`);
      setDetail(d);
    } catch (e) {
      setMsg(friendlyApiError(e));
    }
  }

  async function createTicket() {
    const s = subject.trim();
    const b = body.trim();
    if (s.length < 3) {
      setMsg(\'موضوع حداقل ۳ کاراکتر باشد.\');
      return;
    }
    if (b.length < 2) {
      setMsg(\'متن پیام حداقل ۲ کاراکتر باشد.\');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.post(\'/support/tickets\', { subject: s, body: b });
      setMsg(\'تیکت ثبت شد.\');
      setShowCreate(false);
      setSubject(\'\');
      setBody(\'\');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selectedId || reply.trim().length < 1) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.post(\`/support/tickets/\${selectedId}/messages\`, { body: reply.trim() });
      setReply(\'\');
      setMsg(\'پیام ارسال شد.\');
      await openTicket(selectedId);
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  if (selectedId && detail) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedId(null); setDetail(null); }}>
            ← بازگشت به لیست
          </Button>
          <span className="text-sm text-gray">
            {STATUS_LABEL[detail.status] || detail.status}
          </span>
        </div>
        <Card className="space-y-3">
          <h1 className="text-lg font-bold">{detail.subject}</h1>
          <p className="text-xs text-gray">
            {formatDate(detail.createdAt, { style: \'short\', includeTime: true })}
          </p>
          <ul className="space-y-3">
            {detail.messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.isStaff ? \'bg-coral/10 border border-coral/20\' : \'bg-gray-light/60\'
                }`}
              >
                <p className="text-xs font-medium text-gray mb-1">
                  {m.isStaff ? \'پشتیبانی\' : \'شما\'} ·{' '}
                  {formatDate(m.createdAt, { style: \'short\', includeTime: true })}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
          {detail.status !== \'closed\' && (
            <div className="space-y-2 border-t border-border pt-3">
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="پاسخ یا پیام جدید..."
                maxLength={4000}
              />
              <Button size="sm" loading={busy} onClick={sendReply}>
                ارسال
              </Button>
            </div>
          )}
        </Card>
        {msg && <p className="text-sm text-coral">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">پشتیبانی</h1>
        <Button size="sm" onClick={() => { setShowCreate(true); setMsg(null); }}>
          تیکت جدید
        </Button>
      </div>

      {showCreate && (
        <Card className="space-y-3">
          <h2 className="font-semibold">ثبت تیکت جدید</h2>
          <Input
            placeholder="موضوع"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
          />
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-border px-3 py-2 text-sm"
            placeholder="شرح مشکل یا درخواست..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
          />
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={createTicket}>
              ارسال تیکت
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
              انصراف
            </Button>
          </div>
        </Card>
      )}

      {msg && <p className="text-sm text-coral">{msg}</p>}

      {items.length === 0 ? (
        <PanelEmpty title="تیکتی ندارید" description="برای ارتباط با پشتیبانی، تیکت جدید ثبت کنید." />
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full text-right"
                onClick={() => openTicket(t.id)}
              >
                <Card className="hover:border-coral/40 transition-colors space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{t.subject}</p>
                    <span className="text-xs text-gray">
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                  {t.lastPreview && (
                    <p className="text-sm text-gray line-clamp-1">{t.lastPreview}</p>
                  )}
                  <p className="text-xs text-gray">
                    {formatDate(t.updatedAt, { style: \'short\', includeTime: true })} ·{' '}
                    {t.messageCount} پیام
                  </p>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
''')

    # Admin support page - shortened for size; full in next commit if needed
    write(ROOT / "frontend/src/app/admin/support/page.tsx", """'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';

type TicketListItem = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastPreview?: string | null;
  user?: { id: string; phone?: string | null; accountType?: string; displayName?: string | null } | null;
};

type TicketDetail = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  user?: { id: string; phone?: string | null; accountType?: string; profile?: { displayName?: string | null } | null } | null;
  messages: Array<{ id: string; body: string; isStaff: boolean; createdAt: string; sender?: { profile?: { displayName?: string | null } | null; phone?: string | null } | null }>;
};

const STATUS_LABEL: Record<string, string> = { open: 'باز', answered: 'پاسخ داده شده', closed: 'بسته' };

export default function AdminSupportPage() {
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const q = statusFilter && statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const res = await apiClient.get<{ items?: TicketListItem[] }>(`/support/tickets/all?page=1${q}`);
      setItems(res.items || []);
    } catch (e) { setItems([]); setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function openTicket(id: string) {
    setSelectedId(id); setDetail(null); setReply(''); setMsg(null);
    try { setDetail(await apiClient.get<TicketDetail>(`/support/tickets/${id}`)); }
    catch (e) { setMsg(friendlyApiError(e)); }
  }

  async function sendReply() {
    if (!selectedId || reply.trim().length < 1) return;
    setBusy(true); setMsg(null);
    try {
      await apiClient.post(`/support/tickets/${selectedId}/messages`, { body: reply.trim() });
      setReply(''); setMsg('پاسخ ارسال شد.'); await openTicket(selectedId); await load();
    } catch (e) { setMsg(friendlyApiError(e)); } finally { setBusy(false); }
  }

  async function changeStatus(status: string) {
    if (!selectedId) return;
    setBusy(true); setMsg(null);
    try {
      await apiClient.patch(`/support/tickets/${selectedId}/status`, { status });
      setMsg('وضعیت به‌روز شد.'); await openTicket(selectedId); await load();
    } catch (e) { setMsg(friendlyApiError(e)); } finally { setBusy(false); }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  if (selectedId && detail) {
    const userLabel = detail.user?.profile?.displayName || detail.user?.phone || detail.user?.id?.slice(0, 8) || '—';
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedId(null); setDetail(null); }}>← بازگشت به لیست</Button>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" loading={busy} onClick={() => changeStatus('open')}>باز</Button>
            <Button size="sm" variant="outline" loading={busy} onClick={() => changeStatus('answered')}>پاسخ‌داده‌شده</Button>
            <Button size="sm" variant="outline" loading={busy} onClick={() => changeStatus('closed')}>بستن</Button>
          </div>
        </div>
        <Card className="space-y-3">
          <h1 className="text-lg font-bold">{detail.subject}</h1>
          <p className="text-xs text-gray">کاربر: {userLabel} ({detail.user?.accountType || '—'}) · {STATUS_LABEL[detail.status] || detail.status} · {formatDate(detail.createdAt, { style: 'short', includeTime: true })}</p>
          <ul className="space-y-3">
            {detail.messages.map((m) => (
              <li key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.isStaff ? 'bg-coral/10 border border-coral/20' : 'bg-gray-light/60'}`}>
                <p className="text-xs font-medium text-gray mb-1">{m.isStaff ? 'پشتیبانی' : 'کاربر'} · {formatDate(m.createdAt, { style: 'short', includeTime: true })}</p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-border pt-3">
            <textarea className="min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ پشتیبانی..." maxLength={4000} />
            <Button size="sm" loading={busy} onClick={sendReply}>ارسال پاسخ</Button>
          </div>
        </Card>
        {msg && <p className="text-sm text-coral">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">پشتیبانی</h1>
        <div className="flex gap-2">
          {['all', 'open', 'answered', 'closed'].map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'همه' : STATUS_LABEL[s] || s}
            </Button>
          ))}
        </div>
      </div>
      {msg && <p className="text-sm text-coral">{msg}</p>}
      {items.length === 0 ? (
        <PanelEmpty title="تیکتی نیست" description="هنوز تیکتی ثبت نشده است." />
      ) : (
        <ul className="space-y-2">
          {items.map((t) => {
            const name = t.user?.displayName || t.user?.phone || '—';
            return (
              <li key={t.id}>
                <button type="button" className="w-full text-right" onClick={() => openTicket(t.id)}>
                  <Card className="hover:border-coral/40 transition-colors space-y-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{t.subject}</p>
                      <span className="text-xs text-gray">{STATUS_LABEL[t.status] || t.status}</span>
                    </div>
                    <p className="text-sm text-gray">{name} · {t.user?.accountType || ''}</p>
                    {t.lastPreview && <p className="text-sm text-gray line-clamp-1">{t.lastPreview}</p>}
                    <p className="text-xs text-gray">{formatDate(t.updatedAt, { style: 'short', includeTime: true })} · {t.messageCount} پیام</p>
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
""")

def write_migration() -> None:
    mig_dir = ROOT / "backend/prisma/migrations/20260925180000_support_tickets"
    mig_dir.mkdir(parents=True, exist_ok=True)
    write(mig_dir / "migration.sql", '''-- CreateTable
CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT \'open\',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_user_id_idx" ON "support_tickets"("user_id");
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX IF NOT EXISTS "support_tickets_created_at_idx" ON "support_tickets"("created_at");
CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_id_idx" ON "support_ticket_messages"("ticket_id");
CREATE INDEX IF NOT EXISTS "support_ticket_messages_created_at_idx" ON "support_ticket_messages"("created_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
''')

def main() -> None:
    print("Applying issue #30 support tickets...")
    os.chdir(ROOT)
    patch_schema()
    write_backend()
    patch_app_module()
    write_frontend_pages()
    write_migration()
    print("Done. Support tickets ready.")

if __name__ == "__main__":
    main()
