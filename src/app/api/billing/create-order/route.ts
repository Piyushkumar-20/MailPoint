import { NextResponse } from "next/server";

import { auth } from "@/server/lib/auth";
import { db } from "@/server/db";
import { plans, payments } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getTenantId } from "@/server/lib/tenant";
import { env } from "@/env";
import { RazorpayApiError, createRazorpayOrder } from "@/server/lib/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {

  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [proPlan] = await db
      .select({
        id: plans.id,
        key: plans.key,
        priceAmount: plans.priceAmount,
        currency: plans.currency,
        billingInterval: plans.billingInterval,
        billingIntervalCount: plans.billingIntervalCount,
        isActive: plans.isActive,
      })
      .from(plans)
      .where(eq(plans.id, "plan_pro"))
      .limit(1);

      if (proPlan?.key !== "pro" || !proPlan?.isActive) {
      return NextResponse.json(
        { error: "Pro plan is unavailable." },
        { status: 503 },
      );
    }

    if (proPlan.priceAmount < 100) {
      return NextResponse.json(
        { error: "Configured payment amount must be at least 100 paise." },
        { status: 500 },
      );
    }

    const tenantId = await getTenantId(session.user.id);
    const receipt = `mp_${tenantId.slice(0, 12)}_${Date.now()}`;

    const order = await createRazorpayOrder({
      amount: proPlan.priceAmount,
      currency: proPlan.currency,
      receipt,
    });

    if (
      order.amount !== proPlan.priceAmount ||
      order.currency !== proPlan.currency
    ) {
      console.error("[Razorpay] Order amount/currency mismatch", {
        orderId: order.id,
        expectedAmount: proPlan.priceAmount,
        actualAmount: order.amount,
        expectedCurrency: proPlan.currency,
        actualCurrency: order.currency,
      });

      return NextResponse.json(
        { error: "Razorpay returned an invalid order." },
        { status: 502 },
      );
    }

    await db.insert(payments).values({
      id: `payment_${order.id}`,
      tenantId,
      provider: "razorpay",
      providerOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: "created",
      rawData: {
        orderId: order.id,
        receipt: order.receipt,
        planId: proPlan.id,
        billingInterval: proPlan.billingInterval,
        billingIntervalCount: proPlan.billingIntervalCount,
      },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("[Razorpay Create Order]", error);

    if (error instanceof RazorpayApiError && error.status === 401) {
      return NextResponse.json(
        { error: "Razorpay authentication failed. Check the API credentials." },
        { status: 401 },
      );
    }

    if (error instanceof RazorpayApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create Razorpay order." },
      { status: 500 },
    );
  }
}
