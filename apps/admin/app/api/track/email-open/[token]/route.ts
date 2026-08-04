import { NextResponse } from "next/server";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { logLeadActivity } from "@aiwebsite/db/repositories/leads";
import { getMessageByOpenToken, updateMessage } from "@aiwebsite/db/repositories/messages";

import { clientKey, rateLimited } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64"
);

function pixelResponse(): NextResponse {
  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/** Email open-tracking pixel. Never errors visibly — always returns the GIF. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    if (rateLimited(`email-open:${clientKey(request)}`)) {
      return pixelResponse();
    }
    const { token } = await params;
    const db = createAdminSupabase();
    const message = await getMessageByOpenToken(db, token);
    if (message && !message.opened_at) {
      await updateMessage(db, message.id, { opened_at: new Date().toISOString(), status: "opened" });
      await logLeadActivity(db, message.lead_id, "message_sent", "Email opened", {
        channel: "email",
        message_id: message.id,
      });
    }
  } catch {
    // fall through to the pixel regardless
  }
  return pixelResponse();
}
