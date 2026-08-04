import "server-only";

import type { DbClient, DemoSlotRow, SlotStatus } from "../types";
import { fail } from "./_helpers";

/**
 * Demo subdomain slot pool (migration 0011).
 *
 * Sites are published onto a leased slot (`demo1 … demo10`) rather than a
 * permanent per-business slug. Claim/release run as Postgres functions so
 * two concurrent publishes can never take the same slug — see
 * `aiwebsite_claim_demo_slot` for the `for update skip locked` detail.
 */

/** Days a released slug sits in cooldown before it can be re-leased. */
export const DEFAULT_SLOT_COOLDOWN_DAYS = 3;

export interface DemoSlotWithHolder extends DemoSlotRow {
  site: { id: string; name: string; status: string; demo_expires_at: string | null } | null;
  lead: { id: string; business_name: string; status: string } | null;
}

export async function listDemoSlots(db: DbClient): Promise<DemoSlotWithHolder[]> {
  const { data, error } = await db
    .from("aiwebsite_demo_slots")
    .select(
      "*, site:aiwebsite_sites(id, name, status, demo_expires_at), lead:aiwebsite_leads(id, business_name, status)"
    )
    .order("position", { ascending: true });
  if (error) fail("Failed to list demo slots", error);
  return (data ?? []) as unknown as DemoSlotWithHolder[];
}

export async function getDemoSlot(db: DbClient, slug: string): Promise<DemoSlotRow | null> {
  const { data, error } = await db
    .from("aiwebsite_demo_slots")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail("Failed to load demo slot", error);
  return data;
}

/** The slot a site currently holds, if any. */
export async function getSlotForSite(db: DbClient, siteId: string): Promise<DemoSlotRow | null> {
  const { data, error } = await db
    .from("aiwebsite_demo_slots")
    .select("*")
    .eq("site_id", siteId)
    .maybeSingle();
  if (error) fail("Failed to load slot for site", error);
  return data;
}

export interface SlotCounts {
  total: number;
  free: number;
  occupied: number;
  cooldown: number;
  disabled: number;
  reserved: number;
}

export async function countDemoSlots(db: DbClient): Promise<SlotCounts> {
  const { data, error } = await db.from("aiwebsite_demo_slots").select("status");
  if (error) fail("Failed to count demo slots", error);
  const counts: SlotCounts = {
    total: 0,
    free: 0,
    occupied: 0,
    cooldown: 0,
    disabled: 0,
    reserved: 0,
  };
  for (const row of data ?? []) {
    counts.total += 1;
    counts[row.status as SlotStatus] += 1;
  }
  return counts;
}

export class NoFreeSlotError extends Error {
  constructor() {
    super("No free demo slot available. Release a slot or grow the pool in Settings → Demo slots.");
    this.name = "NoFreeSlotError";
  }
}

/**
 * Lease a slot for a site. Idempotent: if the site already holds one the
 * lease is refreshed rather than a second slot consumed, so retrying a
 * failed publish is safe.
 */
export async function claimDemoSlot(
  db: DbClient,
  input: {
    siteId: string;
    leadId: string | null;
    expiresAt?: string | null;
    preferredSlug?: string | null;
  }
): Promise<DemoSlotRow> {
  const { data, error } = await db.rpc("aiwebsite_claim_demo_slot", {
    p_site_id: input.siteId,
    p_lead_id: input.leadId,
    p_expires_at: input.expiresAt ?? null,
    p_preferred_slug: input.preferredSlug ?? null,
  });
  if (error) {
    if (/no free demo slot/i.test(error.message)) throw new NoFreeSlotError();
    fail("Failed to claim demo slot", error);
  }
  return data as DemoSlotRow;
}

/** Return a slot to the pool. Passes through cooldown unless days = 0. */
export async function releaseDemoSlot(
  db: DbClient,
  slug: string,
  options: { cooldownDays?: number; note?: string } = {}
): Promise<DemoSlotRow> {
  const { data, error } = await db.rpc("aiwebsite_release_demo_slot", {
    p_slug: slug,
    p_cooldown_days: options.cooldownDays ?? DEFAULT_SLOT_COOLDOWN_DAYS,
    p_note: options.note ?? null,
  });
  if (error) fail("Failed to release demo slot", error);
  return data as DemoSlotRow;
}

/** Release whichever slot a site holds. No-op (null) if it holds none. */
export async function releaseSlotForSite(
  db: DbClient,
  siteId: string,
  options: { cooldownDays?: number; note?: string } = {}
): Promise<DemoSlotRow | null> {
  const { data, error } = await db.rpc("aiwebsite_release_demo_slot_for_site", {
    p_site_id: siteId,
    p_cooldown_days: options.cooldownDays ?? DEFAULT_SLOT_COOLDOWN_DAYS,
    p_note: options.note ?? null,
  });
  if (error) fail("Failed to release slot for site", error);
  return (data as DemoSlotRow | null) ?? null;
}

/** cooldown → free for every slot whose cooldown has elapsed. */
export async function sweepDemoSlots(db: DbClient): Promise<number> {
  const { data, error } = await db.rpc("aiwebsite_sweep_demo_slots", {});
  if (error) fail("Failed to sweep demo slots", error);
  return (data as number | null) ?? 0;
}

/** Mirror a site's new expiry onto its slot so the sweep can see it. */
export async function syncSlotExpiry(
  db: DbClient,
  siteId: string,
  expiresAt: string | null
): Promise<void> {
  const { error } = await db
    .from("aiwebsite_demo_slots")
    .update({ expires_at: expiresAt })
    .eq("site_id", siteId);
  if (error) fail("Failed to sync slot expiry", error);
}

export async function setSlotEnabled(
  db: DbClient,
  slug: string,
  enabled: boolean
): Promise<DemoSlotRow> {
  const { data, error } = await db
    .from("aiwebsite_demo_slots")
    .update({ status: enabled ? "free" : "disabled" })
    .eq("slug", slug)
    .is("site_id", null)
    .select("*")
    .single();
  if (error || !data) fail("Failed to change slot availability", error);
  return data;
}

/**
 * Grow the pool to `size` slots (`demo1 … demoN`). Never shrinks — removing
 * a slug that has been shared with a prospect is a manual, deliberate act.
 */
export async function growDemoPool(db: DbClient, size: number): Promise<number> {
  const { data: existing, error: readError } = await db
    .from("aiwebsite_demo_slots")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  if (readError) fail("Failed to read demo pool size", readError);

  const current = existing?.[0]?.position ?? 0;
  if (size <= current) return 0;

  const rows = Array.from({ length: size - current }, (_, i) => ({
    slug: `demo${current + i + 1}`,
    position: current + i + 1,
  }));
  const { error } = await db.from("aiwebsite_demo_slots").insert(rows);
  if (error) fail("Failed to grow demo pool", error);
  return rows.length;
}
