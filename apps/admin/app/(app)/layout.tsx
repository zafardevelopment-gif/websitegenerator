import { redirect } from "next/navigation";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getUserProfile } from "@aiwebsite/db/users";
import { TooltipProvider } from "@aiwebsite/ui";

import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";

// TEMP: auth check disabled for testing (mirrors middleware.ts AUTH_DISABLED).
// Re-enable both before shipping.
const AUTH_DISABLED = true;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware already guards these routes; this is defense in depth.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile;
  if (AUTH_DISABLED && !user) {
    profile = {
      full_name: "Test User",
      email: "test@example.com",
      role: "owner" as const,
    };
  } else {
    if (!user) redirect("/login");

    profile = await getUserProfile(supabase, user.id);
    if (!profile) {
      // Auth session exists but the team row is gone (deleted user).
      await supabase.auth.signOut();
      redirect("/login");
    }
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex min-h-svh w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={{ name: profile.full_name, email: profile.email, role: profile.role }}
          />
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
