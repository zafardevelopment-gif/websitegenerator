import "server-only";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getDecryptedSetting } from "@aiwebsite/db/settings";

export interface PageSpeedScores {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

interface LighthouseResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
      accessibility?: { score?: number };
      "best-practices"?: { score?: number };
      seo?: { score?: number };
    };
  };
  error?: { message?: string };
}

async function getPageSpeedKey(): Promise<string | null> {
  const db = createAdminSupabase();
  return (
    process.env.PAGESPEED_API_KEY?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.pagespeedApiKey).catch(() => null))
  );
}

function toPercent(score: number | undefined): number | null {
  return typeof score === "number" ? Math.round(score * 100) : null;
}

async function fetchStrategy(
  url: string,
  strategy: "mobile" | "desktop",
  apiKey: string
): Promise<PageSpeedScores> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("key", apiKey);
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
    endpoint.searchParams.append("category", category);
  }

  const response = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(45000) });
  const payload = (await response.json().catch(() => ({}))) as LighthouseResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `PageSpeed API HTTP ${response.status}`);
  }

  const categories = payload.lighthouseResult?.categories;
  return {
    performance: toPercent(categories?.performance?.score),
    accessibility: toPercent(categories?.accessibility?.score),
    bestPractices: toPercent(categories?.["best-practices"]?.score),
    seo: toPercent(categories?.seo?.score),
  };
}

export interface PageSpeedResult {
  mobile: PageSpeedScores;
  desktop: PageSpeedScores;
}

/** Runs PageSpeed Insights for both mobile and desktop strategies. */
export async function runPageSpeed(url: string): Promise<PageSpeedResult | null> {
  const apiKey = await getPageSpeedKey();
  if (!apiKey) return null;

  const [mobile, desktop] = await Promise.all([
    fetchStrategy(url, "mobile", apiKey),
    fetchStrategy(url, "desktop", apiKey),
  ]);
  return { mobile, desktop };
}
