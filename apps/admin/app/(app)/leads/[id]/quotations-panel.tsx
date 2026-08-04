"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Download, FileText, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { QuotationRow } from "@aiwebsite/db/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Textarea,
} from "@aiwebsite/ui";

import {
  createQuotationAction,
  generateQuotationPdfAction,
  setQuotationStatusAction,
} from "@/lib/actions/quotations";
import { createPaymentLinkAction } from "@/lib/actions/payments";
import { formatDate } from "@/lib/format";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "outline",
  accepted: "success",
  rejected: "destructive",
  expired: "destructive",
};

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

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

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function NewQuotationDialog({
  leadId,
  open,
  onOpenChange,
  onCreated,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = React.useState("Website project");
  const [gstEnabled, setGstEnabled] = React.useState(true);
  const [gstRate, setGstRate] = React.useState(18);
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<LineItem[]>([
    { description: "Website design & development", quantity: 1, unit_price: 15000 },
  ]);
  const [pending, startTransition] = React.useTransition();

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const gst = gstEnabled ? (subtotal * gstRate) / 100 : 0;

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function submit() {
    startTransition(async () => {
      const result = await createQuotationAction({
        leadId,
        title,
        currency: "INR",
        gstEnabled,
        gstRate,
        notes: notes || null,
        items,
      });
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        onCreated();
        setItems([{ description: "Website design & development", quantity: 1, unit_price: 15000 }]);
        setNotes("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New quotation</DialogTitle>
          <DialogDescription>Line items, GST, and a quote number are assigned automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Line items</Label>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                />
                <Input
                  type="number"
                  className="w-16"
                  min={0.01}
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  className="w-28"
                  min={0}
                  value={item.unit_price}
                  onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={items.length === 1}
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }])}
            >
              <Plus />
              Add line
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
              <Label>GST</Label>
              {gstEnabled && (
                <Input
                  type="number"
                  className="w-16"
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                />
              )}
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">Subtotal {formatInr(subtotal)}</p>
              <p className="font-semibold">Total {formatInr(subtotal + gst)}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || items.some((i) => !i.description.trim())}>
            {pending ? <Loader2 className="animate-spin" /> : <FileText />}
            Create quotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotationRowItem({ quotation, onChanged }: { quotation: QuotationRow; onChanged: () => void }) {
  const [pending, startTransition] = React.useTransition();

  function setStatus(status: "sent" | "accepted" | "rejected") {
    startTransition(async () => {
      const result = await setQuotationStatusAction({ quotationId: quotation.id, status });
      if (result.ok) {
        toast.success(result.message);
        onChanged();
      } else {
        toast.error(result.error);
      }
    });
  }

  function downloadPdf() {
    startTransition(async () => {
      const result = await generateQuotationPdfAction({ quotationId: quotation.id });
      if (result.ok && result.data) {
        downloadBase64Pdf(result.data.base64, result.data.fileName);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function createPaymentLink(purpose: "advance" | "full") {
    startTransition(async () => {
      const result = await createPaymentLinkAction({
        quotationId: quotation.id,
        amountInr: quotation.total,
        purpose,
      });
      if (result.ok && result.data) {
        await navigator.clipboard.writeText(result.data.shortUrl).catch(() => undefined);
        toast.success(`${result.message} Link copied to clipboard.`);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{quotation.title}</p>
          <p className="text-xs text-muted-foreground">
            {quotation.quote_number} · {formatDate(quotation.created_at)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[quotation.status] ?? "outline"}>{quotation.status}</Badge>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{formatInr(quotation.total)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" onClick={downloadPdf} disabled={pending}>
          <Download />
          PDF
        </Button>
        {quotation.status === "draft" && (
          <Button variant="outline" size="sm" onClick={() => setStatus("sent")} disabled={pending}>
            <Send />
            Mark sent
          </Button>
        )}
        {quotation.status === "sent" && (
          <>
            <Button variant="outline" size="sm" onClick={() => setStatus("accepted")} disabled={pending}>
              Accept
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStatus("rejected")} disabled={pending}>
              Reject
            </Button>
          </>
        )}
        {(quotation.status === "sent" || quotation.status === "accepted") && (
          <>
            <Button variant="outline" size="sm" onClick={() => createPaymentLink("advance")} disabled={pending}>
              <CreditCard />
              Advance link
            </Button>
            <Button variant="outline" size="sm" onClick={() => createPaymentLink("full")} disabled={pending}>
              <CreditCard />
              Full link
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function QuotationsPanel({
  leadId,
  quotations,
}: {
  leadId: string;
  quotations: QuotationRow[];
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Quotations
        </CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus />
          New
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {quotations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quotations yet.</p>
        ) : (
          quotations.map((q) => (
            <QuotationRowItem key={q.id} quotation={q} onChanged={() => router.refresh()} />
          ))
        )}
      </CardContent>
      <NewQuotationDialog
        leadId={leadId}
        open={open}
        onOpenChange={setOpen}
        onCreated={() => router.refresh()}
      />
    </Card>
  );
}
