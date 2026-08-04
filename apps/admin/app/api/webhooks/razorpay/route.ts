import { NextResponse, type NextRequest } from "next/server";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { logLeadActivity } from "@aiwebsite/db/repositories/leads";
import { getPaymentByLinkId, updatePayment } from "@aiwebsite/db/repositories/payments";
import type { Json, PaymentStatus } from "@aiwebsite/db/types";

import { getRazorpayWebhookSecret, verifyWebhookSignature } from "@/lib/server/razorpay";

export const dynamic = "force-dynamic";

interface RazorpayWebhookPayload {
  id?: string;
  event: string;
  payload: {
    payment_link?: {
      entity?: { id: string; status: string };
    };
    payment?: {
      entity?: { id: string; status: string };
    };
  };
}

const STATUS_MAP: Record<string, PaymentStatus> = {
  paid: "paid",
  cancelled: "cancelled",
  expired: "failed",
  failed: "failed",
};

/**
 * Razorpay Payment Link webhook — signature-verified, idempotent by
 * `razorpay_link_id`. Handles `payment_link.paid` / `.cancelled` / `.expired`.
 * https://razorpay.com/docs/webhooks/
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = await getRazorpayWebhookSecret();

  if (!secret) {
    return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 503 });
  }
  if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const linkEntity = body.payload.payment_link?.entity;
  if (!linkEntity) {
    // Not a payment-link event we track (e.g. a plain payment.* event) — ack so Razorpay stops retrying.
    return NextResponse.json({ ok: true, skipped: "no payment_link entity" });
  }

  const nextStatus = STATUS_MAP[linkEntity.status];
  if (!nextStatus) {
    return NextResponse.json({ ok: true, skipped: `unhandled status ${linkEntity.status}` });
  }

  const db = createAdminSupabase();
  const payment = await getPaymentByLinkId(db, linkEntity.id);
  if (!payment) {
    return NextResponse.json({ ok: true, skipped: "payment not found for link" });
  }

  // Idempotent: a terminal status is never overwritten by a re-delivered webhook.
  if (payment.status === "paid" || payment.status === "refunded") {
    return NextResponse.json({ ok: true, skipped: "already finalized" });
  }

  const paymentEntity = body.payload.payment?.entity;
  await updatePayment(db, payment.id, {
    status: nextStatus,
    razorpay_payment_id: paymentEntity?.id ?? payment.razorpay_payment_id,
    paid_at: nextStatus === "paid" ? new Date().toISOString() : payment.paid_at,
    webhook_payload: body as unknown as Json,
  });

  await logLeadActivity(
    db,
    payment.lead_id,
    "payment",
    `Payment ${nextStatus} — ₹${payment.amount.toLocaleString("en-IN")}`,
    { payment_id: payment.id, event: body.event }
  );

  return NextResponse.json({ ok: true, status: nextStatus });
}
