import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { TEMPLATES } from "@aiwebsite/templates";
import { Badge } from "@aiwebsite/ui";

import { TemplatePreview } from "./template-preview";

export const metadata: Metadata = {
  title: "Template preview",
};

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const template = TEMPLATES[key];
  if (!template) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/templates"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Template library
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
          <Badge variant="secondary">{template.category}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{template.description}</p>
      </div>

      <TemplatePreview
        templateKey={template.key}
        colorVariants={template.colorVariants.map((v) => ({ key: v.key, label: v.label, primary: v.primary }))}
        layoutVariants={template.layoutVariants}
      />
    </div>
  );
}
