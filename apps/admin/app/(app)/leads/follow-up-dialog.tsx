"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { LeadRow } from "@aiwebsite/db/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@aiwebsite/ui";

import { addFollowUpAction } from "@/lib/actions/leads";

function defaultDueDate(): string {
  const d = new Date(Date.now() + 2 * 86400_000);
  return d.toISOString().slice(0, 10);
}

export function FollowUpDialog({
  lead,
  onOpenChange,
}: {
  lead: LeadRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [dueDate, setDueDate] = React.useState(defaultDueDate);
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (lead) {
      setDueDate(defaultDueDate());
      setNote("");
    }
  }, [lead]);

  function submit() {
    if (!lead) return;
    startTransition(async () => {
      const result = await addFollowUpAction({ leadId: lead.id, dueDate, note });
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={lead !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add follow-up</DialogTitle>
          <DialogDescription>{lead?.business_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="follow-up-date">Due date</Label>
            <Input
              id="follow-up-date"
              type="date"
              value={dueDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="follow-up-note">Note (optional)</Label>
            <Textarea
              id="follow-up-note"
              rows={3}
              placeholder="e.g. Call after 6pm, owner is free then"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || !dueDate}>
            {isPending && <Loader2 className="animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
