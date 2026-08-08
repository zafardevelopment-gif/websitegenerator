import type { Metadata } from "next";
import { Globe } from "lucide-react";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { createServerSupabase } from "@aiwebsite/db/server";
import { listSites } from "@aiwebsite/db/repositories/sites";
import { getDecryptedSetting } from "@aiwebsite/db/settings";
import type { LeadRow } from "@aiwebsite/db/types";
import { Card, CardContent } from "@aiwebsite/ui";

import { demoUrl, sitesBaseUrl } from "@/lib/urls";

import { NewSitePicker } from "./new-site-picker";
import { SiteCards, type GeneratorSiteCard } from "./site-cards";

export const metadata: Metadata = {
  title: "Generator",
};

export default async function GeneratorPage() {
  const supabase = await createServerSupabase();
  const sites = await listSites(supabase, {}, 100);

  // One round-trip for every lead behind the listed sites.
  const leadIds = [...new Set(sites.map((s) => s.lead_id).filter(Boolean))];
  const leadsById = new Map<
    string,
    Pick<LeadRow, "id" | "status" | "owner_name" | "phone" | "whatsapp" | "category">
  >();
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("aiwebsite_leads")
      .select("id, status, owner_name, phone, whatsapp, category")
      .in("id", leadIds);
    for (const lead of data ?? []) leadsById.set(lead.id, lead);
  }

  const sitesUrl = sitesBaseUrl();
  const adminSupa = createAdminSupabase();
  const callNumber = await getDecryptedSetting(
    adminSupa,
    SETTING_KEYS.whatsappCallbackNumber
  ).catch(() => null);
  const cloudPhoneNumberId = await getDecryptedSetting(
    adminSupa,
    SETTING_KEYS.whatsappCloudPhoneNumberId
  ).catch(() => null);
  const cloudConfigured = !!cloudPhoneNumberId;

  const cards: GeneratorSiteCard[] = sites.map((site) => {
    const lead = leadsById.get(site.lead_id);
    return {
      id: site.id,
      name: site.name,
      slug: site.slug,
      status: site.status,
      updatedAt: site.updated_at,
      // Live sites get their public URL; drafts share the preview link.
      demoLink:
        site.status === "live"
          ? demoUrl(site.slug)
          : `${sitesUrl}/preview/site/${site.id}`,
      leadId: site.lead_id,
      leadStatus: lead?.status ?? null,
      ownerName: lead?.owner_name ?? null,
      phone: lead?.whatsapp ?? lead?.phone ?? null,
      category: lead?.category ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Globe className="h-6 w-6 text-muted-foreground" />
            Website generator
          </h1>
          <p className="text-sm text-muted-foreground">
            Lead → template → AI content → edit → deploy. Target: under 3 minutes.
          </p>
        </div>
        <NewSitePicker />
      </div>

      {cards.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No websites yet. Pick a lead above to generate the first one.
          </CardContent>
        </Card>
      ) : (
        <SiteCards sites={cards} callNumber={callNumber} cloudConfigured={cloudConfigured} />
      )}
    </div>
  );
}
