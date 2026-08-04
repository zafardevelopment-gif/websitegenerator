"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { MessageRow, MessageTemplateRow } from "@aiwebsite/db/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@aiwebsite/ui";

import {
  generateEmailDraftAction,
  generateProposalPdfAction,
  generateWhatsAppDraftAction,
  logWhatsAppSentAction,
  sendEmailAction,
} from "@/lib/actions/outreach";
import { formatDateTime } from "@/lib/format";

const CHANNEL_ICON = { whatsapp: MessageCircle, email: Mail } as const;
const STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  draft: "secondary",
  sent: "success",
  delivered: "success",
  read: "success",
  opened: "success",
  failed: "destructive",
};

function downloadBase64Pdf(base64: string, fileName: string) {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  const blob = new Blob([array], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function OutreachPanel({
  leadId,
  hasEmail,
  whatsappTemplates,
  emailTemplates,
  messages,
}: {
  leadId: string;
  hasEmail: boolean;
  whatsappTemplates: MessageTemplateRow[];
  emailTemplates: MessageTemplateRow[];
  messages: MessageRow[];
}) {
  const router = useRouter();

  // WhatsApp
  const [waTemplateKey, setWaTemplateKey] = React.useState(whatsappTemplates[0]?.key ?? "");
  const [personalize, setPersonalize] = React.useState(true);
  const [waText, setWaText] = React.useState("");
  const [waLink, setWaLink] = React.useState("");
  const [waLoading, startWaLoading] = React.useTransition();
  const [waSending, startWaSending] = React.useTransition();

  function draftWhatsApp() {
    startWaLoading(async () => {
      const result = await generateWhatsAppDraftAction({
        leadId,
        templateKey: waTemplateKey,
        personalize,
      });
      if (result.ok && result.data) {
        setWaText(result.data.text);
        setWaLink(result.data.waLink);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function sendWhatsApp() {
    window.open(waLink, "_blank", "noreferrer");
    startWaSending(async () => {
      const result = await logWhatsAppSentAction({ leadId, text: waText, templateKey: waTemplateKey });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // Email
  const [emailTemplateKey, setEmailTemplateKey] = React.useState(emailTemplates[0]?.key ?? "");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [emailLoading, startEmailLoading] = React.useTransition();
  const [emailSending, startEmailSending] = React.useTransition();

  function draftEmail() {
    startEmailLoading(async () => {
      const result = await generateEmailDraftAction({ leadId, templateKey: emailTemplateKey });
      if (result.ok && result.data) {
        setSubject(result.data.subject);
        setBody(result.data.body);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function sendEmail() {
    startEmailSending(async () => {
      const result = await sendEmailAction({ leadId, subject, body });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // PDF proposal
  const [weaknesses, setWeaknesses] = React.useState<string[]>(["No mobile-friendly website"]);
  const [features, setFeatures] = React.useState<string[]>([
    "Custom domain & hosting",
    "Mobile-optimized design",
    "Google Maps & WhatsApp integration",
    "Ongoing maintenance & support",
  ]);
  const [pricing, setPricing] = React.useState<{ description: string; amount: number }[]>([
    { description: "Website design & development", amount: 15000 },
    { description: "Domain + hosting (1 year)", amount: 3000 },
  ]);
  const [gstEnabled, setGstEnabled] = React.useState(true);
  const [pdfLoading, startPdfLoading] = React.useTransition();

  function updateList(list: string[], setList: (v: string[]) => void, index: number, value: string) {
    setList(list.map((item, i) => (i === index ? value : item)));
  }

  function generatePdf() {
    startPdfLoading(async () => {
      const result = await generateProposalPdfAction({
        leadId,
        weaknesses: weaknesses.filter(Boolean),
        features: features.filter(Boolean),
        pricing: pricing.filter((p) => p.description),
        gstEnabled,
        gstRate: 18,
      });
      if (result.ok && result.data) {
        downloadBase64Pdf(result.data.base64, result.data.fileName);
        toast.success(result.message);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outreach</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="whatsapp">
          <TabsList className="w-full">
            <TabsTrigger value="whatsapp" className="flex-1">
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="email" className="flex-1">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Email
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex-1">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              PDF
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              History
            </TabsTrigger>
          </TabsList>

          {/* WhatsApp */}
          <TabsContent value="whatsapp" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <NativeSelect value={waTemplateKey} onChange={(e) => setWaTemplateKey(e.target.value)}>
                {whatsappTemplates.length === 0 && <option value="">No templates found</option>}
                {whatsappTemplates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
              <div className="flex items-center gap-2">
                <Switch id="personalize" checked={personalize} onCheckedChange={setPersonalize} />
                <Label htmlFor="personalize" className="text-sm">
                  AI-personalize with review data
                </Label>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={draftWhatsApp}
              disabled={waLoading || !waTemplateKey}
            >
              {waLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Generate draft
            </Button>
            {waText && (
              <>
                <Textarea rows={7} value={waText} onChange={(e) => setWaText(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={sendWhatsApp} disabled={waSending}>
                    {waSending ? <Loader2 className="animate-spin" /> : <Send />}
                    Open in WhatsApp & log as sent
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(waText);
                      toast.success("Copied");
                    }}
                  >
                    <Copy />
                    Copy
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Email */}
          <TabsContent value="email" className="space-y-3">
            {!hasEmail ? (
              <p className="text-sm text-muted-foreground">This lead has no email address.</p>
            ) : (
              <>
                <NativeSelect value={emailTemplateKey} onChange={(e) => setEmailTemplateKey(e.target.value)}>
                  {emailTemplates.length === 0 && <option value="">No templates found</option>}
                  {emailTemplates.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={draftEmail}
                  disabled={emailLoading || !emailTemplateKey}
                >
                  {emailLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Generate draft
                </Button>
                {body && (
                  <>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
                    <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
                    <Button onClick={sendEmail} disabled={emailSending}>
                      {emailSending ? <Loader2 className="animate-spin" /> : <Send />}
                      Send email
                    </Button>
                  </>
                )}
              </>
            )}
          </TabsContent>

          {/* PDF proposal */}
          <TabsContent value="pdf" className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Problems found</Label>
              <div className="mt-1 space-y-1.5">
                {weaknesses.map((w, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Input value={w} onChange={(e) => updateList(weaknesses, setWeaknesses, i, e.target.value)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setWeaknesses(weaknesses.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setWeaknesses([...weaknesses, ""])}>
                  <Plus />
                  Add
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Features included</Label>
              <div className="mt-1 space-y-1.5">
                {features.map((f, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Input value={f} onChange={(e) => updateList(features, setFeatures, i, e.target.value)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFeatures(features.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setFeatures([...features, ""])}>
                  <Plus />
                  Add
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pricing</Label>
              <div className="mt-1 space-y-1.5">
                {pricing.map((line, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Input
                      className="flex-1"
                      value={line.description}
                      onChange={(e) =>
                        setPricing(
                          pricing.map((p, j) => (j === i ? { ...p, description: e.target.value } : p))
                        )
                      }
                    />
                    <Input
                      type="number"
                      className="w-28"
                      value={line.amount}
                      onChange={(e) =>
                        setPricing(
                          pricing.map((p, j) => (j === i ? { ...p, amount: Number(e.target.value) || 0 } : p))
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPricing(pricing.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPricing([...pricing, { description: "", amount: 0 }])}
                >
                  <Plus />
                  Add line
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="gst" checked={gstEnabled} onCheckedChange={setGstEnabled} />
              <Label htmlFor="gst" className="text-sm">
                Include GST (18%)
              </Label>
            </div>
            <Button onClick={generatePdf} disabled={pdfLoading}>
              {pdfLoading ? <Loader2 className="animate-spin" /> : <FileText />}
              Generate & download PDF
            </Button>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="space-y-2">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outreach sent yet.</p>
            ) : (
              messages.map((msg) => {
                const Icon = CHANNEL_ICON[msg.channel];
                return (
                  <div key={msg.id} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      {msg.subject && <p className="font-medium">{msg.subject}</p>}
                      <p className="line-clamp-2 text-xs text-muted-foreground">{msg.body}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(msg.created_at)}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[msg.status] ?? "secondary"}>{msg.status}</Badge>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
