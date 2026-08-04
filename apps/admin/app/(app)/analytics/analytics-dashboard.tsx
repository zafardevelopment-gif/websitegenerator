"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BUSINESS_CATEGORIES } from "@aiwebsite/config";
import type { AnalyticsFilters } from "@aiwebsite/db/repositories/analytics";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
} from "@aiwebsite/ui";

import { exportLeadsCsvAction, getAnalyticsSnapshotAction, type AnalyticsSnapshot } from "@/lib/actions/analytics";
import { CHART_INK, CHART_SERIES } from "@/lib/chart-colors";
import { LEAD_STATUS_LABELS } from "@/lib/lead-meta";

function downloadCsv(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function ChartCard({
  title,
  description,
  onExport,
  children,
}: {
  title: string;
  description?: string;
  onExport?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download />
            CSV
          </Button>
        )}
      </CardHeader>
      <CardContent className="h-72">{children}</CardContent>
    </Card>
  );
}

function toCsv<T extends object>(rows: T[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0] as object) as (keyof T)[];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => escape(r[c])).join(","))].join("\n");
}

const axisProps = {
  tick: { fill: CHART_INK.muted, fontSize: 11 },
  axisLine: { stroke: CHART_INK.grid },
  tickLine: false,
};

export function AnalyticsDashboard() {
  const [filters, setFilters] = React.useState<AnalyticsFilters>({});
  const [snapshot, setSnapshot] = React.useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);

  const load = React.useCallback((f: AnalyticsFilters) => {
    setLoading(true);
    void getAnalyticsSnapshotAction(f).then((result) => {
      setSnapshot(result);
      setLoading(false);
    });
  }, []);

  React.useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    load(filters);
  }

  async function exportAll() {
    setExporting(true);
    const csv = await exportLeadsCsvAction(filters);
    downloadCsv(csv, `leads-export-${new Date().toISOString().slice(0, 10)}.csv`);
    setExporting(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  fromIso: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  toIso: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <NativeSelect
              className="w-44"
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
            >
              <option value="">All</option>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Area</Label>
            <Input
              className="w-40"
              placeholder="e.g. Karol Bagh"
              onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value || undefined }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Source</Label>
            <Input
              className="w-40"
              placeholder="e.g. google_maps"
              onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value || undefined }))}
            />
          </div>
          <Button onClick={applyFilters} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "Apply"}
          </Button>
          <Button variant="outline" onClick={exportAll} disabled={exporting} className="ml-auto">
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            Export all leads (CSV)
          </Button>
        </CardContent>
      </Card>

      {!snapshot ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {loading ? "Loading analytics…" : "No data available yet."}
          </CardContent>
        </Card>
      ) : (
        <>
          <ChartCard
            title="Funnel"
            description="Each stage includes leads that reached it or moved further."
            onExport={() => downloadCsv(toCsv(snapshot.funnel), "funnel.csv")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.funnel} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid horizontal={false} stroke={CHART_INK.grid} />
                <XAxis type="number" {...axisProps} />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={120}
                  {...axisProps}
                  tickFormatter={(v: string) => LEAD_STATUS_LABELS[v as keyof typeof LEAD_STATUS_LABELS] ?? v}
                />
                <Tooltip
                  formatter={(value: number, _name, item) => [
                    `${value} (${item.payload.conversionFromPrev !== null ? `${Math.round(item.payload.conversionFromPrev * 100)}% from prev` : "baseline"})`,
                    "Leads",
                  ]}
                  labelFormatter={(v: string) => LEAD_STATUS_LABELS[v as keyof typeof LEAD_STATUS_LABELS] ?? v}
                />
                <Bar dataKey="count" fill={CHART_SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Weekly activity"
              description="New leads, generated, and won — last 12 weeks."
              onExport={() => downloadCsv(toCsv(snapshot.weeklyActivity), "weekly-activity.csv")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshot.weeklyActivity}>
                  <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
                  <XAxis dataKey="weekStart" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="leads" name="New leads" stroke={CHART_SERIES[0]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="generated" name="Generated" stroke={CHART_SERIES[1]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="won" name="Won" stroke={CHART_SERIES[3]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Category performance"
              description="Total leads and win rate by category."
              onExport={() => downloadCsv(toCsv(snapshot.categoryPerformance), "category-performance.csv")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshot.categoryPerformance.slice(0, 8)}>
                  <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
                  <XAxis dataKey="category" {...axisProps} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis {...axisProps} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill={CHART_SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Area performance"
              description="Top 15 areas by lead volume."
              onExport={() => downloadCsv(toCsv(snapshot.areaPerformance), "area-performance.csv")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshot.areaPerformance} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid horizontal={false} stroke={CHART_INK.grid} />
                  <XAxis type="number" {...axisProps} />
                  <YAxis type="category" dataKey="area" width={110} {...axisProps} />
                  <Tooltip />
                  <Bar dataKey="total" fill={CHART_SERIES[1]} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Win rate trend"
              description="Won ÷ (Won + Lost) per month."
              onExport={() => downloadCsv(toCsv(snapshot.winRateTrend), "win-rate-trend.csv")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshot.winRateTrend}>
                  <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                  <Tooltip formatter={(v: number) => `${Math.round(v * 100)}%`} />
                  <Line type="monotone" dataKey="winRate" stroke={CHART_SERIES[3]} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard
            title="AI cost vs revenue won"
            description="Monthly AI spend (₹) against revenue from paid quotations."
            onExport={() => downloadCsv(toCsv(snapshot.aiCostVsRevenue), "ai-cost-vs-revenue.csv")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.aiCostVsRevenue}>
                <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="aiCostInr" name="AI cost (₹)" fill={CHART_SERIES[5]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="revenueWon" name="Revenue won (₹)" fill={CHART_SERIES[3]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}
