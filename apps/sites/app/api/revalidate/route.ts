import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/** Constant-time string compare — avoids leaking secret length/prefix via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Cache invalidation endpoint called by the admin app on publish/update
 * (Phase 9). Body: { "tag": "site:<slug>", "secret": "<REVALIDATE_SECRET>" }.
 */
export async function POST(request: NextRequest) {
  let body: { tag?: unknown; secret?: unknown };
  try {
    body = (await request.json()) as { tag?: unknown; secret?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const secret = process.env.REVALIDATE_SECRET;
  const bodySecret = typeof body.secret === "string" ? body.secret : "";
  if (!secret || !safeEqual(bodySecret, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tag = typeof body.tag === "string" ? body.tag : "";
  if (!/^site:[a-z0-9.-]{1,80}$/.test(tag)) {
    return NextResponse.json({ ok: false, error: "Invalid tag" }, { status: 400 });
  }

  revalidateTag(tag);
  return NextResponse.json({ ok: true, tag, revalidatedAt: new Date().toISOString() });
}
