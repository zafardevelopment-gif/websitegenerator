import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getLead } from "@aiwebsite/db/repositories/leads";

import { LeadForm } from "../../lead-form";

export const metadata: Metadata = {
  title: "Edit lead",
};

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const lead = await getLead(supabase, id);
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/leads/${lead.id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {lead.business_name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit lead</h1>
      </div>
      <LeadForm lead={lead} />
    </div>
  );
}
