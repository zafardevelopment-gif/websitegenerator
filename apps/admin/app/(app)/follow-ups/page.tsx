import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { listActiveFollowUpsWithLead } from "@aiwebsite/db/repositories/follow-ups";

import { FollowUpsManager } from "./follow-ups-manager";

export const metadata: Metadata = {
  title: "Follow-ups",
};

export default async function FollowUpsPage() {
  const supabase = await createServerSupabase();
  const followUps = await listActiveFollowUpsWithLead(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CalendarClock className="h-6 w-6 text-muted-foreground" />
          Follow-ups
        </h1>
        <p className="text-sm text-muted-foreground">
          Auto-suggested when a lead&apos;s status changes; snooze, complete, or reschedule from here.
        </p>
      </div>
      <FollowUpsManager initialFollowUps={followUps} />
    </div>
  );
}
