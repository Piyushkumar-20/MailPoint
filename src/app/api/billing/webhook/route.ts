import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import {
  recordAndProcessRazorpayWebhook,
  type RazorpayWebhookEvent,
} from "@/server/lib/razorpay-webhook";

export const runtime = "nodejs";

function signaturesMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature")?.trim() ?? "";
  const providerEventId =
    request.headers.get("x-razorpay-event-id")?.trim() ?? "";

  if (!rawBody || !signature || !providerEventId) {
    return NextResponse.json(
      { error: "Missing Razorpay webhook body, signature, or event ID." },
      { status: 400 },
    );
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured.");
  
    return NextResponse.json(
      { error: "Razorpay webhook secret is not configured." },
      { status: 500 },
    );
  }
  
  const expectedSignature = createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  if (!signaturesMatch(expectedSignature, signature)) {
    return NextResponse.json(
      { error: "Invalid Razorpay webhook signature." },
      { status: 400 },
    );
  }

  let payload: RazorpayWebhookEvent;

  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookEvent;
  } catch {
    return NextResponse.json(
      { error: "Invalid Razorpay webhook JSON payload." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "Invalid Razorpay webhook payload." },
      { status: 400 },
    );
  }

  const event = payload;

  if (typeof event.event !== "string" || !event.event.trim()) {
    return NextResponse.json(
      { error: "Razorpay webhook event type is missing." },
      { status: 400 },
    );
  }

  try {
    const result = await recordAndProcessRazorpayWebhook({
      providerEventId,
      eventType: event.event,
      payload,
    });

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      status: result.result.status,
      message: result.result.message,
    });
  } catch (error) {
    console.error("[Razorpay Webhook]", error);

    // Return a non-2xx response so Razorpay can retry a transient processing
    // failure according to its webhook delivery policy.
    return NextResponse.json(
      { error: "Razorpay webhook processing failed." },
      { status: 500 },
    );
  }
}
