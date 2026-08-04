import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { AnalyticsDashboard } from "./analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics",
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Funnel conversion, weekly activity, category and area performance, win rate, and AI
          spend vs revenue won.
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
