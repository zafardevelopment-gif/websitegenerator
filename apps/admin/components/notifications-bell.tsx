"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  Check,
  Clock,
  MessageCircle,
  Newspaper,
  Send,
  ShieldAlert,
  Zap,
} from "lucide-react";

import type { NotificationRow, NotificationType } from "@aiwebsite/db/types";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aiwebsite/ui";

import {
  getNotificationsSnapshotAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationsSnapshot,
} from "@/lib/actions/notifications";
import { formatRelative } from "@/lib/format";

const POLL_MS = 30_000;

const ICONS: Record<NotificationType, typeof Zap> = {
  demo_first_view: Zap,
  demo_cta_click: MessageCircle,
  form_submission: Send,
  daily_digest: Newspaper,
  renewal_reminder: Calendar,
  demo_expiring_soon: Clock,
  inbound_reply: MessageCircle,
  inbound_reply_ambiguous: ShieldAlert,
};

export function NotificationsBell() {
  const router = useRouter();
  const [snapshot, setSnapshot] = React.useState<NotificationsSnapshot>({ unread: 0, recent: [] });
  const [open, setOpen] = React.useState(false);

  const refresh = React.useCallback(() => {
    void getNotificationsSnapshotAction().then(setSnapshot);
  }, []);

  React.useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  function open_(item: NotificationRow) {
    void markNotificationReadAction(item.id);
    setSnapshot((s) => ({
      unread: Math.max(0, s.unread - (item.is_read ? 0 : 1)),
      recent: s.recent.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
    }));
    if (item.lead_id) router.push(`/leads/${item.lead_id}`);
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) refresh();
        setOpen(nextOpen);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {snapshot.unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
            >
              {snapshot.unread > 9 ? "9+" : snapshot.unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {snapshot.unread > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline"
              onClick={() => {
                void markAllNotificationsReadAction();
                setSnapshot((s) => ({ unread: 0, recent: s.recent.map((n) => ({ ...n, is_read: true })) }));
              }}
            >
              <Check className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {snapshot.recent.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            No demo views or clicks yet.
          </p>
        )}
        <div className="max-h-80 overflow-y-auto">
          {snapshot.recent.map((item) => {
            const Icon = ICONS[item.type];
            return (
              <DropdownMenuItem
                key={item.id}
                className={item.is_read ? "opacity-60" : undefined}
                onSelect={() => open_(item)}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{formatRelative(item.created_at)}</p>
                </div>
                {!item.is_read && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/" className="justify-center text-xs text-muted-foreground">
            View dashboard
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
