"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ExternalLink, RefreshCw } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Label,
  NativeSelect,
} from "@aiwebsite/ui";

import { generateWebsiteAction } from "@/lib/actions/generator";

export interface WizardTemplate {
  key: string;
  name: string;
  category: string;
  description: string;
  colorVariants: { key: string; label: string; primary: string; secondary: string }[];
  layoutVariants: { key: string; label: string }[];
}

const TONES = [
  { key: "premium", label: "Premium" },
  { key: "friendly", label: "Friendly" },
  { key: "medical-professional", label: "Medical-professional" },
  { key: "luxury", label: "Luxury" },
];

export function GenerateWizard({
  leadId,
  templates,
  defaultTemplateKey,
  sitesUrl,
}: {
  leadId: string;
  templates: WizardTemplate[];
  defaultTemplateKey: string;
  /** Base URL of the sites app, used to embed the live `/preview/[template]` route. */
  sitesUrl: string;
}) {
  const router = useRouter();
  const [templateKey, setTemplateKey] = React.useState(defaultTemplateKey);
  const [colorVariant, setColorVariant] = React.useState<string>("");
  const [layoutVariant, setLayoutVariant] = React.useState<string>("");
  const [tone, setTone] = React.useState("premium");
  const [language, setLanguage] = React.useState("en");
  const [isPending, startTransition] = React.useTransition();
  const [previewKey, setPreviewKey] = React.useState(0);

  const template = templates.find((t) => t.key === templateKey) ?? templates[0];
  const effectiveColor = template?.colorVariants.some((v) => v.key === colorVariant)
    ? colorVariant
    : (template?.colorVariants[0]?.key ?? "");
  const effectiveLayout = template?.layoutVariants.some((v) => v.key === layoutVariant)
    ? layoutVariant
    : (template?.layoutVariants[0]?.key ?? "");

  const previewUrl = template
    ? `${sitesUrl}/preview/${template.key}?color=${encodeURIComponent(effectiveColor)}&layout=${encodeURIComponent(effectiveLayout)}&tone=${encodeURIComponent(tone)}`
    : null;

  function generate() {
    startTransition(async () => {
      const result = await generateWebsiteAction({
        leadId,
        templateKey,
        colorVariant: effectiveColor,
        layoutVariant: effectiveLayout,
        tone,
        language,
      });
      if (result.ok && result.data) {
        toast.success(result.message);
        router.push(`/generator/${result.data.siteId}`);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1 · Template</CardTitle>
          <CardDescription>Category-matched template pre-selected — switch freely.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={isPending}
              onClick={() => setTemplateKey(t.key)}
              className={cn(
                "rounded-lg border p-4 text-left transition-all",
                templateKey === t.key
                  ? "border-primary ring-2 ring-primary/30"
                  : "hover:border-muted-foreground/40"
              )}
            >
              <div
                className="mb-2 h-14 rounded-md"
                style={{
                  background: `linear-gradient(120deg, ${t.colorVariants[0]?.primary}, ${t.colorVariants[0]?.secondary})`,
                }}
              />
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.category}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2 · Style & voice</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Color scheme</Label>
            <div className="flex flex-wrap gap-2">
              {template?.colorVariants.map((variant) => (
                <button
                  key={variant.key}
                  type="button"
                  title={variant.label}
                  disabled={isPending}
                  aria-pressed={effectiveColor === variant.key}
                  onClick={() => setColorVariant(variant.key)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-transform hover:scale-110",
                    effectiveColor === variant.key ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: variant.primary }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wizard-layout">Layout</Label>
            <NativeSelect
              id="wizard-layout"
              value={effectiveLayout}
              disabled={isPending}
              onChange={(e) => setLayoutVariant(e.target.value)}
            >
              {template?.layoutVariants.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wizard-tone">Tone</Label>
            <NativeSelect
              id="wizard-tone"
              value={tone}
              disabled={isPending}
              onChange={(e) => setTone(e.target.value)}
            >
              {TONES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wizard-language">Language</Label>
            <NativeSelect
              id="wizard-language"
              value={language}
              disabled={isPending}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="bilingual">Bilingual (EN primary + Hindi version)</option>
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button size="lg" onClick={generate} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {isPending ? "Generating content…" : "Generate website"}
        </Button>
        {isPending && (
          <Badge variant="secondary" className="animate-pulse">
            Claude is writing — usually 30–90 seconds
          </Badge>
        )}
      </div>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Live preview</CardTitle>
              <CardDescription>Updates as you change template, color, layout or tone.</CardDescription>
            </div>
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Reload preview"
                onClick={() => setPreviewKey((k) => k + 1)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {previewUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Open
                  </a>
                </Button>
              )}
            </span>
          </CardHeader>
          <CardContent>
            {previewUrl ? (
              <iframe
                key={`${previewKey}-${previewUrl}`}
                src={previewUrl}
                title="Template preview"
                className="h-[70vh] w-full rounded-md border bg-white shadow-sm"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a template to preview it.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
