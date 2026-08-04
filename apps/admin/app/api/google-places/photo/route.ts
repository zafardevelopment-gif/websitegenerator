import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabase } from "@aiwebsite/db/server";

import { fetchPlacePhotoBytes } from "@/lib/server/google-places";

export const dynamic = "force-dynamic";

/** Proxies a Google Place photo so the API key never reaches the browser. */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) return NextResponse.json({ error: "Missing ref" }, { status: 400 });

  const photo = await fetchPlacePhotoBytes(ref);
  if (!photo) return NextResponse.json({ error: "Photo not available" }, { status: 404 });

  return new NextResponse(new Uint8Array(photo.buffer), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
