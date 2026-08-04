"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@aiwebsite/ui";

/** QR code for a live demo — great for in-person visits. Download as PNG. */
export function QrDialog({
  url,
  title,
  open,
  onOpenChange,
}: {
  url: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: "M" })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [url, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="break-all font-mono text-xs">{url}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center rounded-lg border bg-white p-4">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={`QR code for ${url}`} className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-sm text-muted-foreground">
              Generating…
            </div>
          )}
        </div>
        <div className="flex justify-center gap-2">
          {dataUrl && (
            <Button asChild>
              <a href={dataUrl} download={`${title.replace(/[^a-z0-9]+/gi, "-")}-qr.png`}>
                <Download />
                Download PNG
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              toast.success("URL copied");
            }}
          >
            <Copy />
            Copy URL
          </Button>
          <Button variant="outline" asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink />
              Open
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
