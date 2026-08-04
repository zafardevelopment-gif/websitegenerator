import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { listMessageTemplates } from "@aiwebsite/db/repositories/message-templates";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aiwebsite/ui";

export const metadata: Metadata = {
  title: "Outreach",
};

export default async function OutreachPage() {
  const supabase = await createServerSupabase();
  const templates = await listMessageTemplates(supabase);
  const whatsapp = templates.filter((t) => t.channel === "whatsapp");
  const email = templates.filter((t) => t.channel === "email");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
          Outreach
        </h1>
        <p className="text-sm text-muted-foreground">
          WhatsApp pitches, email, and PDF proposals are sent from each lead&apos;s detail page —
          this page shows your active message templates. Full template editing arrives with the
          Prompt/Message Template Manager upgrade.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">WhatsApp templates</CardTitle>
            <CardDescription>Used by the pitch generator on each lead.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {whatsapp.length === 0 && (
              <p className="text-sm text-muted-foreground">
                None yet — run <code className="font-mono text-xs">supabase/APPLY_ALL.sql</code>{" "}
                seed section for the default Hinglish sequence.
              </p>
            )}
            {whatsapp.map((t) => (
              <div key={t.id} className="rounded-md border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <code className="font-mono text-xs">{t.key}</code>
                  <Badge variant="outline" className="text-[10px]">
                    v{t.version}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email templates</CardTitle>
            <CardDescription>Used by the email generator on each lead.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {email.length === 0 && (
              <p className="text-sm text-muted-foreground">None yet — run the seed script.</p>
            )}
            {email.map((t) => (
              <div key={t.id} className="rounded-md border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <code className="font-mono text-xs">{t.key}</code>
                  <Badge variant="outline" className="text-[10px]">
                    v{t.version}
                  </Badge>
                </div>
                <p className="text-xs font-medium">{t.subject}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
