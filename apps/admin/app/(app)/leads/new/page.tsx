import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { LeadForm } from "../lead-form";

export const metadata: Metadata = {
  title: "New lead",
};

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/leads"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leads
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New lead</h1>
        <p className="text-sm text-muted-foreground">
          Only the business name is required — enrich the rest as you learn more.
        </p>
      </div>
      <LeadForm />
    </div>
  );
}
