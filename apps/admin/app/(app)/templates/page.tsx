import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LayoutTemplate } from "lucide-react";

import { TEMPLATE_LIST } from "@aiwebsite/templates";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aiwebsite/ui";

const SITES_URL = process.env.NEXT_PUBLIC_SITES_URL ?? "http://localhost:3001";

export const metadata: Metadata = {
  title: "Templates",
};

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <LayoutTemplate className="h-6 w-6 text-muted-foreground" />
          Template library
        </h1>
        <p className="text-sm text-muted-foreground">
          {TEMPLATE_LIST.length} flagship templates. Every template ships color and layout variants
          so similar businesses never get identical demos.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATE_LIST.map((template) => {
          const defaultLayout = template.layoutVariants[0]?.key ?? "";
          return (
            <Card key={template.key} className="h-full transition-all hover:shadow-md">
              <CardHeader>
                <Link href={`/templates/${template.key}`} className="group">
                  <div
                    className="mb-3 flex h-28 items-end justify-between rounded-lg p-4"
                    style={{
                      background: `linear-gradient(120deg, ${template.colorVariants[0]?.primary}, ${template.colorVariants[0]?.secondary})`,
                    }}
                  >
                    <span className="font-semibold text-white drop-shadow">{template.name}</span>
                  </div>
                  <CardTitle className="flex items-center justify-between">
                    {template.name}
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                </Link>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{template.category}</Badge>
                  <Badge variant="outline">{template.layoutVariants.length} layouts</Badge>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {template.colorVariants.length} color variants — click to preview
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {template.colorVariants.map((variant) => (
                      <a
                        key={variant.key}
                        href={`${SITES_URL}/preview/${template.key}?color=${variant.key}&layout=${defaultLayout}`}
                        target="_blank"
                        rel="noreferrer"
                        title={`Preview ${variant.label}`}
                        className="group flex items-center gap-1.5 rounded-full border bg-muted/30 py-1 pl-1 pr-2.5 text-xs transition-colors hover:border-foreground/40 hover:bg-muted"
                      >
                        <span
                          className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: variant.primary }}
                        />
                        <span className="text-muted-foreground group-hover:text-foreground">
                          {variant.label}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
