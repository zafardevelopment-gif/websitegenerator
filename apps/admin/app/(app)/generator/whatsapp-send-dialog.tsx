"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@aiwebsite/ui";

import { logWhatsAppSentAction } from "@/lib/actions/outreach";
import { waLink } from "@/lib/lead-meta";

export type WhatsAppTarget = {
  leadId: string;
  siteName: string;
  ownerName: string | null;
  phone: string | null;
  demoLink: string;
  /** Lead's business category (e.g. "Dental Clinic", "Gym") — picks the pitch wording. */
  category: string | null;
};

/**
 * One pitch config per sector — matched against the lead's category by
 * keyword. Add a new entry here whenever a new template ships (see
 * packages/templates/src/registry.tsx for the matching template list).
 */
interface SectorPitch {
  test: RegExp;
  /** What the business is called mid-sentence, e.g. "your {noun}". */
  noun: string;
  /** Dental leads get the "Dr." honorific; everyone else gets a plain greeting. */
  useDrGreeting?: boolean;
}

const SECTOR_PITCHES: SectorPitch[] = [
  { test: /dental|dentist|orthodont/i, noun: "clinic", useDrGreeting: true },
  { test: /restaurant|cafe|café|dhaba|bakery|food|diner|eatery/i, noun: "restaurant" },
  { test: /salon|spa|parlour|parlor|beauty/i, noun: "salon" },
  { test: /gym|fitness|crossfit|yoga|workout/i, noun: "gym" },
  { test: /clinic|hospital|physio|health/i, noun: "clinic" },
];

function pitchFor(category: string | null): SectorPitch {
  if (category) {
    const match = SECTOR_PITCHES.find((p) => p.test.test(category));
    if (match) return match;
  }
  return { noun: "business" };
}

/** Default pitch text per sector — editable in the dialog before sending. */
export function buildDemoPitch({
  ownerName,
  category,
  demoLink,
}: {
  ownerName: string | null;
  category: string | null;
  demoLink: string;
}): string {
  const { noun, useDrGreeting } = pitchFor(category);
  const greeting = useDrGreeting
    ? ownerName
      ? `Hi Dr. ${ownerName} 👋`
      : "Hi Dr. 👋"
    : ownerName
      ? `Hi ${ownerName} 👋`
      : "Hi there 👋";

  return [
    greeting,
    `Noticed your ${noun}'s great Google reviews — made you a free demo website.`,
    `🌐 ${demoLink}`,
    `Like it? Reply here or call me to make it official.`,
  ].join("\n");
}

export function WhatsAppSendDialog({
  target,
  onOpenChange,
}: {
  target: WhatsAppTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [sending, startSending] = React.useTransition();

  // Reset the draft whenever a different site is picked.
  React.useEffect(() => {
    if (target) setText(buildDemoPitch(target));
  }, [target]);

  function openAndLog() {
    if (!target) return;
    const href = target.phone ? waLink(target.phone, text) : null;
    if (href) window.open(href, "_blank", "noreferrer");

    startSending(async () => {
      const result = await logWhatsAppSentAction({ leadId: target.leadId, text });
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
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Send demo on WhatsApp
          </DialogTitle>
          <DialogDescription>
            {target?.siteName}
            {target?.phone ? ` · ${target.phone}` : " · no WhatsApp number on this lead"}
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-3">
            <a
              href={target.demoLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 break-all font-mono text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {target.demoLink}
            </a>
            <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(text);
              toast.success("Message copied");
            }}
          >
            <Copy />
            Copy
          </Button>
          <Button onClick={openAndLog} disabled={sending || !target?.phone || !text.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            Open WhatsApp &amp; log as sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
