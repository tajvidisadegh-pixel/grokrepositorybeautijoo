#!/usr/bin/env python3
"""Apply gap 18.14 frontend patches (additive)."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
GOOD = "7be43fdb4c710908551bd2bebc8bfe74cf4088c0"


def git_show(path: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"{GOOD}:{path}"], cwd=ROOT, text=True
    )


def main() -> None:
    # 1) Restore panel-api from good SHA + markAll
    api_path = ROOT / "frontend/src/lib/panel-api.ts"
    text = git_show("frontend/src/lib/panel-api.ts")
    if "markAllNotificationsRead" not in text:
        old = (
            "export async function markNotificationRead(id: string) {\n"
            "  return apiClient.patch(`/notifications/${id}/read`);\n"
            "}"
        )
        new = (
            old
            + "\nexport async function markAllNotificationsRead() {\n"
            + "  return apiClient.patch<{ message: string; updated: number }>('/notifications/read-all');\n"
            + "}"
        )
        if old not in text:
            print("panel-api anchor missing", file=sys.stderr)
            sys.exit(1)
        text = text.replace(old, new, 1)
    api_path.write_text(text)
    assert api_path.stat().st_size > 20000
    print("panel-api", api_path.stat().st_size)

    # 2) panel-shell interval
    shell = ROOT / "frontend/src/components/panel/panel-shell.tsx"
    st = shell.read_text()
    if "45_000" not in st:
        old = (
            "    if (typeof window !== 'undefined') {\n"
            "      window.addEventListener('focus', onFocus);\n"
            "      window.addEventListener('beautijoo:unread-changed', onUnreadChanged);\n"
            "    }\n\n"
            "    return () => {\n"
            "      cancelled = true;\n"
            "      if (typeof window !== 'undefined') {\n"
            "        window.removeEventListener('focus', onFocus);\n"
            "        window.removeEventListener('beautijoo:unread-changed', onUnreadChanged);\n"
            "      }\n"
            "    };"
        )
        new = (
            "    if (typeof window !== 'undefined') {\n"
            "      window.addEventListener('focus', onFocus);\n"
            "      window.addEventListener('beautijoo:unread-changed', onUnreadChanged);\n"
            "    }\n"
            "    const timer = window.setInterval(() => {\n"
            "      if (document.visibilityState === 'visible') void refreshUnread();\n"
            "    }, 45_000);\n\n"
            "    return () => {\n"
            "      cancelled = true;\n"
            "      window.clearInterval(timer);\n"
            "      if (typeof window !== 'undefined') {\n"
            "        window.removeEventListener('focus', onFocus);\n"
            "        window.removeEventListener('beautijoo:unread-changed', onUnreadChanged);\n"
            "      }\n"
            "    };"
        )
        if old not in st:
            print("panel-shell anchor missing", file=sys.stderr)
            sys.exit(1)
        shell.write_text(st.replace(old, new, 1))
    print("panel-shell ok")

    # 3) header NotificationBell
    header = ROOT / "frontend/src/components/layout/header.tsx"
    ht = header.read_text()
    if "NotificationBell" not in ht:
        ht = ht.replace(
            "import { Logo } from '@/components/brand/logo';",
            "import { Logo } from '@/components/brand/logo';\n"
            "import { NotificationBell } from '@/components/layout/notification-bell';",
        )
        needle = (
            '          <Link\n'
            '            href="/search"\n'
            '            className="flex size-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-gray transition-colors hover:bg-coral-soft hover:text-coral md:hidden"\n'
            '            aria-label="جستجو"\n'
            '          >\n'
            '            <Search className="size-5" aria-hidden />\n'
            '          </Link>\n\n'
            '          {!loading && isAuthenticated ? ('
        )
        insert = (
            '          <Link\n'
            '            href="/search"\n'
            '            className="flex size-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-gray transition-colors hover:bg-coral-soft hover:text-coral md:hidden"\n'
            '            aria-label="جستجو"\n'
            '          >\n'
            '            <Search className="size-5" aria-hidden />\n'
            '          </Link>\n\n'
            '          <NotificationBell />\n\n'
            '          {!loading && isAuthenticated ? ('
        )
        if needle not in ht:
            print("header needle missing", file=sys.stderr)
            sys.exit(1)
        ht = ht.replace(needle, insert, 1)
        header.write_text(ht)
    print("header ok")

    # 4) notifications page — only inject mark-all if missing
    page = ROOT / "frontend/src/app/panel/notifications/page.tsx"
    pt = page.read_text()
    if "markAllNotificationsRead" not in pt:
        pt = pt.replace(
            "import { fetchNotifications, markNotificationRead, type NotificationItem } from '@/lib/panel-api';",
            "import {\n"
            "  fetchNotifications,\n"
            "  markNotificationRead,\n"
            "  markAllNotificationsRead,\n"
            "  type NotificationItem,\n"
            "} from '@/lib/panel-api';",
        )
        # add state + button after markingId state
        if "markingAll" not in pt:
            pt = pt.replace(
                "const [markingId, setMarkingId] = useState<string | null>(null);",
                "const [markingId, setMarkingId] = useState<string | null>(null);\n"
                "  const [markingAll, setMarkingAll] = useState(false);\n"
                "  const unreadCount = items.filter((n) => !n.readAt).length;",
            )
            # handleMarkAll function before handleOpen
            handle_all = (
                "  async function handleMarkAll() {\n"
                "    if (markingAll || unreadCount === 0) return;\n"
                "    setMarkingAll(true);\n"
                "    setError(null);\n"
                "    try {\n"
                "      await markAllNotificationsRead();\n"
                "      setItems((prev) =>\n"
                "        prev.map((row) =>\n"
                "          row.readAt ? row : { ...row, readAt: new Date().toISOString() },\n"
                "        ),\n"
                "      );\n"
                "      emitUnreadChanged();\n"
                "    } catch (e) {\n"
                "      setError(friendlyApiError(e));\n"
                "    } finally {\n"
                "      setMarkingAll(false);\n"
                "    }\n"
                "  }\n\n"
            )
            pt = pt.replace("  function handleOpen(n: NotificationItem) {", handle_all + "  function handleOpen(n: NotificationItem) {")
            # header UI
            old_h = (
                '      <div>\n'
                '        <h1 className="text-2xl font-bold">اعلان‌ها</h1>\n'
                '        <p className="mt-1 text-sm text-gray">\n'
                '          روی هر پیام بزنید تا باز شود و به‌عنوان خوانده‌شده ثبت شود\n'
                '        </p>\n'
                '      </div>'
            )
            new_h = (
                '      <div className="flex flex-wrap items-start justify-between gap-3">\n'
                '        <div>\n'
                '          <h1 className="text-2xl font-bold">اعلان‌ها</h1>\n'
                '          <p className="mt-1 text-sm text-gray">\n'
                '            روی هر پیام بزنید تا باز شود و به‌عنوان خوانده‌شده ثبت شود\n'
                '          </p>\n'
                '        </div>\n'
                '        {unreadCount > 0 && (\n'
                '          <button\n'
                '            type="button"\n'
                '            onClick={() => void handleMarkAll()}\n'
                '            disabled={markingAll}\n'
                '            className="h-10 shrink-0 rounded-2xl border border-coral/40 bg-coral-soft/40 px-4 text-sm font-medium text-coral transition hover:bg-coral-soft disabled:opacity-60"\n'
                '          >\n'
                '            {markingAll ? "در حال ثبت…" : `خواندن همه (${unreadCount.toLocaleString("fa-IR")})`}\n'
                '          </button>\n'
                '        )}\n'
                '      </div>'
            )
            if old_h not in pt:
                print("page header anchor missing", file=sys.stderr)
                sys.exit(1)
            pt = pt.replace(old_h, new_h, 1)
        page.write_text(pt)
    print("notifications page ok")

    bell = ROOT / "frontend/src/components/layout/notification-bell.tsx"
    if not bell.exists() or bell.stat().st_size < 500:
        print("notification-bell missing or too small", file=sys.stderr)
        sys.exit(1)
    print("done")


if __name__ == "__main__":
    main()
