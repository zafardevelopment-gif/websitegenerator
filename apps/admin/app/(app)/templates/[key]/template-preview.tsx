"use client";

import * as React from "react";
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react";

import { Button, cn, Label, NativeSelect, Switch } from "@aiwebsite/ui";

const SITES_URL = process.env.NEXT_PUBLIC_SITES_URL ?? "http://localhost:3001";

type Device = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export function TemplatePreview({
  templateKey,
  colorVariants,
  layoutVariants,
}: {
  templateKey: string;
  colorVariants: { key: string; label: string; primary: string }[];
  layoutVariants: { key: string; label: string }[];
}) {
  const [color, setColor] = React.useState(colorVariants[0]?.key ?? "");
  const [layout, setLayout] = React.useState(layoutVariants[0]?.key ?? "");
  const [device, setDevice] = React.useState<Device>("desktop");
  const [banner, setBanner] = React.useState(true);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [failed, setFailed] = React.useState(false);

  const src = `${SITES_URL}/preview/${templateKey}?color=${color}&layout=${layout}&banner=${banner ? "1" : "0"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="space-y-1">
          <Label className="text-xs">Color scheme</Label>
          <div className="flex gap-1.5">
            {colorVariants.map((variant) => (
              <button
                key={variant.key}
                type="button"
                title={variant.label}
                aria-label={`Color: ${variant.label}`}
                aria-pressed={color === variant.key}
                onClick={() => setColor(variant.key)}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                  color === variant.key ? "border-foreground" : "border-transparent"
                )}
                style={{ backgroundColor: variant.primary }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="layout-variant" className="text-xs">
            Layout
          </Label>
          <NativeSelect
            id="layout-variant"
            className="h-8 w-52"
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
          >
            {layoutVariants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-center gap-2 pb-1">
          <Switch id="banner-toggle" checked={banner} onCheckedChange={setBanner} />
          <Label htmlFor="banner-toggle" className="text-xs">
            Demo banner
          </Label>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {(
            [
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const
          ).map(([key, Icon]) => (
            <Button
              key={key}
              variant={device === key ? "secondary" : "ghost"}
              size="icon"
              aria-label={`${key} preview`}
              onClick={() => setDevice(key)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reload preview"
            onClick={() => {
              setFailed(false);
              setReloadKey((k) => k + 1);
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={src} target="_blank" rel="noreferrer">
              <ExternalLink />
              Open
            </a>
          </Button>
        </div>
      </div>

      <div className="flex justify-center overflow-x-auto rounded-lg border bg-muted/40 p-3">
        {failed ? (
          <div className="flex h-96 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Preview server not reachable</p>
            <p>
              Start the renderer with{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                npm run dev:sites
              </code>{" "}
              then reload.
            </p>
            <Button variant="outline" size="sm" onClick={() => { setFailed(false); setReloadKey((k) => k + 1); }}>
              <RefreshCw />
              Retry
            </Button>
          </div>
        ) : (
          <iframe
            key={`${src}-${reloadKey}`}
            src={src}
            title="Template preview"
            onError={() => setFailed(true)}
            className="h-[75vh] rounded-md border bg-white shadow-sm transition-[width] duration-300"
            style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%" }}
          />
        )}
      </div>
    </div>
  );
}
