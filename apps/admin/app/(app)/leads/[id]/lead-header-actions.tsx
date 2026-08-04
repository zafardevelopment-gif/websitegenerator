"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Globe, MessageCircle, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { LeadRow, LeadStatus } from "@aiwebsite/db/types";
import { Button, NativeSelect } from "@aiwebsite/ui";

import { deleteLeadAction, restoreLeadAction, setLeadStatusAction } from "@/lib/actions/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, waLink } from "@/lib/lead-meta";

import { FollowUpDialog } from "../follow-up-dialog";

export function LeadHeaderActions({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [followUpOpen, setFollowUpOpen] = React.useState(false);
  const isDeleted = lead.deleted_at !== null;
  const phone = lead.whatsapp ?? lead.phone;

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  if (isDeleted) {
    return (
      <div className="flex items-center gap-2">
        <Button onClick={() => run(() => restoreLeadAction(lead.id))} disabled={isPending}>
          <RotateCcw />
          Restore lead
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="Change status"
        className="w-48"
        value={lead.status}
        disabled={isPending}
        onChange={(e) => run(() => setLeadStatusAction(lead.id, e.target.value as LeadStatus))}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </NativeSelect>

      <Button variant="outline" asChild>
        <Link href={`/generator/new?leadId=${lead.id}`}>
          <Globe />
          Generate website
        </Link>
      </Button>

      <Button variant="outline" onClick={() => setFollowUpOpen(true)} disabled={isPending}>
        <CalendarPlus />
        Follow-up
      </Button>

      {phone && (
        <Button variant="outline" asChild>
          <a href={waLink(phone)} target="_blank" rel="noreferrer">
            <MessageCircle />
            WhatsApp
          </a>
        </Button>
      )}

      <Button variant="outline" asChild>
        <Link href={`/leads/${lead.id}/edit`}>
          <Pencil />
          Edit
        </Link>
      </Button>

      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => run(() => deleteLeadAction(lead.id))}
        disabled={isPending}
      >
        <Trash2 />
        Delete
      </Button>

      <FollowUpDialog
        lead={followUpOpen ? lead : null}
        onOpenChange={(open) => setFollowUpOpen(open)}
      />
    </div>
  );
}
