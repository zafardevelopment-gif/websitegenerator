import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getLead } from "@aiwebsite/db/repositories/leads";
import { TEMPLATE_LIST } from "@aiwebsite/templates";

import { RatingCell } from "@/components/lead-badges";

import { GenerateWizard, type WizardTemplate } from "./generate-wizard";

export const metadata: Metadata = {
  title: "Generate website",
};

export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;
  if (!leadId) redirect("/generator");

  const supabase = await createServerSupabase();
  const lead = await getLead(supabase, leadId);
  if (!lead) notFound();

  // Serializable template metadata for the client wizard.
  const templates: WizardTemplate[] = TEMPLATE_LIST.map((t) => ({
    key: t.key,
    name: t.name,
    category: t.category,
    description: t.description,
    colorVariants: t.colorVariants.map((v) => ({
      key: v.key,
      label: v.label,
      primary: v.primary,
      secondary: v.secondary,
    })),
    layoutVariants: t.layoutVariants.map((v) => ({ key: v.key, label: v.label })),
  }));

  // Pre-select the template matching the lead's category, else general.
  const defaultTemplateKey =
    TEMPLATE_LIST.find((t) => t.category === lead.category)?.key ?? "general";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href={`/leads/${lead.id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {lead.business_name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Generate website</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {lead.business_name}
          {lead.category && <> · {lead.category}</>}
          {[lead.area, lead.city].filter(Boolean).length > 0 && (
            <> · {[lead.area, lead.city].filter(Boolean).join(", ")}</>
          )}
          <RatingCell rating={lead.google_rating} reviews={lead.review_count} />
        </p>
      </div>

      <GenerateWizard
        leadId={lead.id}
        templates={templates}
        defaultTemplateKey={defaultTemplateKey}
      />
    </div>
  );
}
