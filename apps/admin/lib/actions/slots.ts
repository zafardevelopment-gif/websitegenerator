"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase } from "@aiwebsite/db/server";
import {
  countDemoSlots,
  growDemoPool,
  listDemoSlots,
  releaseDemoSlot,
  setSlotEnabled,
  sweepDemoSlots,
  type DemoSlotWithHolder,
  type SlotCounts,
} from "@aiwebsite/db/repositories/demo-slots";
import { getSite, updateSite } from "@aiwebsite/db/repositories/sites";
import { logLeadActivity } from "@aiwebsite/db/repositories/leads";

import { revalidateSiteTag } from "../server/renderer";

/**
 * Demo slot pool management (roadmap Phase 1).
 *
 * The pool is the scarce resource in the outreach funnel: you can only have
 * as many live pitches as you have subdomains. These actions are what the
 * Settings → Demo slots view drives.
 */

export type SlotResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string };

function friendly(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/row-level security/i.test(message)) return "You don't have permission for that.";
  if (/does not exist|schema cache/i.test(message)) {
    return "Demo slot tables missing — apply supabase/migrations/0011_demo_slots.sql.";
  }
  return message;
}

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

export async function loadSlotsAction(): Promise<{
  slots: DemoSlotWithHolder[];
  counts: SlotCounts;
  error?: string;
}> {
  try {
    const { supabase } = await requireUser();
    const [slots, counts] = await Promise.all([
      listDemoSlots(supabase),
      countDemoSlots(supabase),
    ]);
    return { slots, counts };
  } catch (e) {
    return {
      slots: [],
      counts: { total: 0, free: 0, occupied: 0, cooldown: 0, disabled: 0, reserved: 0 },
      error: friendly(e),
    };
  }
}

const releaseSchema = z.object({
  slug: z.string().min(3).max(63),
  /** 0 = straight back to free, skipping cooldown. */
  cooldownDays: z.number().int().min(0).max(30).default(3),
  note: z.string().max(200).optional(),
});

/**
 * Force a slot back into the pool from the slots view.
 *
 * Also retires the holding site's copy of the slug — `aiwebsite_sites.slug`
 * is unique, so leaving it in place would block the next lease.
 */
export async function releaseSlotAction(input: unknown): Promise<SlotResult> {
  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid release request" };

  try {
    const { supabase, user } = await requireUser();
    const slots = await listDemoSlots(supabase);
    const slot = slots.find((s) => s.slug === parsed.data.slug);
    if (!slot) return { ok: false, error: "Slot not found" };
    if (slot.status === "disabled") return { ok: false, error: "This slot is disabled." };

    if (slot.site_id) {
      const site = await getSite(supabase, slot.site_id);
      if (site) {
        if (site.slug === slot.slug) {
          const suffix = site.id.replace(/-/g, "").slice(0, 6);
          await updateSite(supabase, site.id, { slug: `${slot.slug}-${suffix}` });
        }
        await updateSite(supabase, site.id, {
          status: "archived",
          archived_at: new Date().toISOString(),
        });
        await logLeadActivity(
          supabase,
          site.lead_id,
          "system",
          `Demo slot ${slot.slug} released from the pool view`,
          { site_id: site.id, slug: slot.slug },
          user.id
        );
      }
    }

    await releaseDemoSlot(supabase, parsed.data.slug, {
      cooldownDays: parsed.data.cooldownDays,
      note: parsed.data.note,
    });
    await revalidateSiteTag(parsed.data.slug);

    revalidatePath("/settings/slots");
    revalidatePath("/deployments");
    return {
      ok: true,
      message:
        parsed.data.cooldownDays > 0
          ? `${parsed.data.slug} released — free in ${parsed.data.cooldownDays} days.`
          : `${parsed.data.slug} is free again.`,
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function setSlotEnabledAction(
  slug: unknown,
  enabled: unknown
): Promise<SlotResult> {
  const parsed = z
    .object({ slug: z.string().min(3).max(63), enabled: z.boolean() })
    .safeParse({ slug, enabled });
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase } = await requireUser();
    await setSlotEnabled(supabase, parsed.data.slug, parsed.data.enabled);
    revalidatePath("/settings/slots");
    return {
      ok: true,
      message: parsed.data.enabled
        ? `${parsed.data.slug} is back in rotation.`
        : `${parsed.data.slug} taken out of rotation.`,
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

/**
 * Grow the pool. Shrinking is deliberately not offered — a slug that has
 * already been sent to a prospect shouldn't vanish; disable it instead.
 */
export async function growPoolAction(size: unknown): Promise<SlotResult<{ added: number }>> {
  const parsed = z.number().int().min(1).max(200).safeParse(size);
  if (!parsed.success) return { ok: false, error: "Pool size must be between 1 and 200." };

  try {
    const { supabase } = await requireUser();
    const added = await growDemoPool(supabase, parsed.data);
    revalidatePath("/settings/slots");
    return {
      ok: true,
      message: added === 0 ? "Pool already at or above that size." : `Added ${added} slot(s).`,
      data: { added },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

/** Manually run the cooldown → free sweep (the cron does this nightly). */
export async function sweepSlotsAction(): Promise<SlotResult<{ freed: number }>> {
  try {
    const { supabase } = await requireUser();
    const freed = await sweepDemoSlots(supabase);
    revalidatePath("/settings/slots");
    return {
      ok: true,
      message: freed === 0 ? "Nothing to sweep." : `${freed} slot(s) returned to free.`,
      data: { freed },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
