"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, MessageCircle, Send, Zap } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  Textarea,
} from "@aiwebsite/ui";

import { logWhatsAppSentAction, sendDemoPitchTemplateAction } from "@/lib/actions/outreach";
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
  /** Whether the Meta Cloud API credentials are configured — shows/hides the template button. */
  cloudConfigured?: boolean;
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
  const [sendingTemplate, startSendingTemplate] = React.useTransition();

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

  function sendViaTemplate() {
    if (!target) return;
    startSendingTemplate(async () => {
      const result = await sendDemoPitchTemplateAction({
        leadId: target.leadId,
        demoLink: target.demoLink,
      });
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const isBusy = sending || sendingTemplate;

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

            {/* Template send — shown when Cloud API is configured */}
            {(target.cloudConfigured || target.cloudConfigured === undefined) && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
                      <Zap className="h-3.5 w-3.5" />
                      Send via approved template
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sends{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                        demo_pitch_intro
                      </code>{" "}
                      directly — no phone app needed. Lead auto-advances to{" "}
                      <Badge variant="secondary" className="text-[10px]">
                        WhatsApp Sent
                      </Badge>
                      .
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-green-600 hover:bg-green-700 text-white"
                    disabled={isBusy || !target.phone}
                    onClick={sendViaTemplate}
                  >
                    {sendingTemplate ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    Send
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            <p className="text-xs text-muted-foreground">
              Or edit and send manually via WhatsApp:
            </p>
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
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
          <Button onClick={openAndLog} disabled={isBusy || !target?.phone || !text.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            Open WhatsApp &amp; log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
