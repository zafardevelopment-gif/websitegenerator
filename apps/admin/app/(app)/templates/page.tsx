import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LayoutTemplate } from "lucide-react";

import { TEMPLATE_LIST } from "@aiwebsite/templates";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aiwebsite/ui";

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
        {TEMPLATE_LIST.map((template) => (
          <Link key={template.key} href={`/templates/${template.key}`} className="group">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardHeader>
                <div
                  className="mb-3 flex h-28 items-end justify-between rounded-lg p-4"
                  style={{
                    background: `linear-gradient(120deg, ${template.colorVariants[0]?.primary}, ${template.colorVariants[0]?.secondary})`,
                  }}
                >
                  <span className="font-semibold text-white drop-shadow">{template.name}</span>
                  <span className="flex gap-1.5">
                    {template.colorVariants.map((variant) => (
                      <span
                        key={variant.key}
                        title={variant.label}
                        className="h-4 w-4 rounded-full border border-white/60"
                        style={{ backgroundColor: variant.primary }}
                      />
                    ))}
                  </span>
                </div>
                <CardTitle className="flex items-center justify-between">
                  {template.name}
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{template.category}</Badge>
                <Badge variant="outline">{template.colorVariants.length} colors</Badge>
                <Badge variant="outline">{template.layoutVariants.length} layouts</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
