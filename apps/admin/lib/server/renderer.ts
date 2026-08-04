import "server-only";

/**
 * Cache invalidation on the sites renderer. Best-effort: if the renderer is
 * unreachable the tag simply expires via its 5-minute safety window.
 */
export async function revalidateSiteTag(
  slug: string
): Promise<{ ok: boolean; detail: string }> {
  const base = process.env.NEXT_PUBLIC_SITES_URL ?? "http://localhost:3001";
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return { ok: false, detail: "REVALIDATE_SECRET not set — relying on 5-min cache window" };
  }
  try {
    const response = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: `site:${slug}`, secret }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { ok: false, detail: `revalidate HTTP ${response.status}` };
    }
    return { ok: true, detail: "cache revalidated" };
  } catch (e) {
    return {
      ok: false,
      detail: `renderer unreachable (${e instanceof Error ? e.message : "error"}) — 5-min window applies`,
    };
  }
}
