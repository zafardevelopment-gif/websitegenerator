import type { Metadata } from "next";
import { Users2 } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { listClients } from "@aiwebsite/db/repositories/clients";
import { listDomainsBySite } from "@aiwebsite/db/repositories/domains";

import { isDomainConnectConfigured } from "@/lib/actions/domains";

import { ClientsManager } from "./clients-manager";

export const metadata: Metadata = {
  title: "Clients",
};

export default async function ClientsPage() {
  const supabase = await createServerSupabase();
  const [clients, domainConnectConfigured] = await Promise.all([
    listClients(supabase),
    isDomainConnectConfigured(),
  ]);
  const domainsByClient = await Promise.all(
    clients.map(async (c) => ({
      clientId: c.id,
      domains: c.site_id ? await listDomainsBySite(supabase, c.site_id) : [],
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Users2 className="h-6 w-6 text-muted-foreground" />
          Clients
        </h1>
        <p className="text-sm text-muted-foreground">
          Permanent projects converted from won leads — onboarding checklist, custom domain, and
          renewal tracking.
        </p>
      </div>
      <ClientsManager
        clients={clients}
        domainsByClient={Object.fromEntries(domainsByClient.map((d) => [d.clientId, d.domains]))}
        domainConnectConfigured={domainConnectConfigured}
      />
    </div>
  );
}
