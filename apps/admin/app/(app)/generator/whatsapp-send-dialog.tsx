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
import { buildDemoPitchText } from "@/lib/whatsapp-pitch";

export type WhatsAppTarget = {
  leadId: string;
  siteName: string;
  ownerName: string | null;
  phone: string | null;
  demoLink: string;
  /** Lead's business category (e.g. "Dental Clinic", "Gym") — picks the pitch wording. */
  category: string | null;
  /** Call-back number configured in Settings → API Keys → Meta WhatsApp Cloud API. */
  callNumber?: string | null;
};

/** Default pitch text per sector — editable in the dialog before sending. */
export const buildDemoPitch = buildDemoPitchText;

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
