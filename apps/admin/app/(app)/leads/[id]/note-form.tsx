"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button, Textarea } from "@aiwebsite/ui";

import { addLeadNoteAction } from "@/lib/actions/leads";

export function NoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");

  function submit() {
    const trimmed = note.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addLeadNoteAction({ leadId, note: trimmed });
      if (result.ok) {
        setNote("");
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={2}
        placeholder="Add a note to the timeline…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        disabled={isPending}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={isPending || !note.trim()}>
          {isPending ? <Loader2 className="animate-spin" /> : <Send />}
          Add note
        </Button>
      </div>
    </div>
  );
}
