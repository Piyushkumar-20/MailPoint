import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { auth } from "@/server/lib/auth";
import { db } from "@/server/db";
import { payments } from "@/server/db/schema";
import { getTenantId } from "@/server/lib/tenant";
import {
  activateSelfPaidProEntitlement,
  getEntitlementByTenantId,
} from "@/server/lib/entitlements";
import {
  getRazorpayOrder,
  getRazorpayPayment,
  RazorpayApiError,
} from "@/server/lib/razorpay";
import { env } from "@/env";

export const runtime = "nodejs";

type VerifyPaymentBody = {
  razorpay_payment_id?: unknown;
  razorpay_order_id?: unknown;
  razorpay_signature?: unknown;
};

function signaturesMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as VerifyPaymentBody;
    const paymentId =
      typeof body.razorpay_payment_id === "string"
        ? body.razorpay_payment_id.trim()
        : "";
    const returnedOrderId =
      typeof body.razorpay_order_id === "string"
        ? body.razorpay_order_id.trim()
        : "";
    const signature =
      typeof body.razorpay_signature === "string"
        ? body.razorpay_signature.trim()
        : "";

    if (!paymentId || !returnedOrderId || !signature) {
      return NextResponse.json(
        { error: "razorpay_payment_id, razorpay_order_id and razorpay_signature are required." },
        { status: 400 },
      );
    }

    const tenantId = await getTenantId(session.user.id);
    const [paymentRecord] = await db
      .select({
        id: payments.id,
        providerOrderId: payments.providerOrderId,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        providerPaymentId: payments.providerPaymentId,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.provider, "razorpay"),
          eq(payments.providerOrderId, returnedOrderId),
        ),
      )
      .limit(1);

    if (!paymentRecord?.providerOrderId) {
      return NextResponse.json(
        { error: "Razorpay order was not created for this account." },
        { status: 400 },
      );
    }

    if (
      paymentRecord.status === "captured" &&
      paymentRecord.providerPaymentId === paymentId
    ) {
      const entitlement = await getEntitlementByTenantId(tenantId);

      return NextResponse.json({
        success: true,
        payment_id: paymentId,
        order_id: paymentRecord.providerOrderId,
        entitlement,
      });
    }

    // Razorpay explicitly requires using the order_id retrieved from the
    // server for signature verification rather than trusting the value
    // returned by the browser.
    const orderId = paymentRecord.providerOrderId;
    const generatedSignature = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (!signaturesMatch(generatedSignature, signature)) {
      await db
        .update(payments)
        .set({
          status: "failed",
          errorCode: "SIGNATURE_MISMATCH",
          errorDescription: "Razorpay payment signature verification failed.",
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentRecord.id));

      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 },
      );
    }

    const [order, payment] = await Promise.all([
      getRazorpayOrder(orderId),
      getRazorpayPayment(paymentId),
    ]);

    if (payment.order_id !== orderId) {
      return NextResponse.json(
        { error: "Payment does not belong to the expected Razorpay order." },
        { status: 400 },
      );
    }

    if (
      payment.amount !== paymentRecord.amount ||
      payment.currency !== paymentRecord.currency ||
      order.amount !== paymentRecord.amount ||
      order.currency !== paymentRecord.currency
    ) {
      return NextResponse.json(
        { error: "Payment amount or currency does not match the order." },
        { status: 400 },
      );
    }

    const now = new Date();
    const paymentStatus =
      payment.status === "captured"
        ? "captured"
        : payment.status === "authorized"
          ? "authorized"
          : payment.status === "failed"
            ? "failed"
            : payment.status === "refunded"
              ? "refunded"
              : "created";

    await db
      .update(payments)
      .set({
        providerPaymentId: payment.id,
        status: paymentStatus,
        method: payment.method ?? null,
        errorCode: payment.error_code ?? null,
        errorDescription: payment.error_description ?? null,
        paidAt: payment.status === "captured" ? now : null,
        rawData: { order, payment },
        updatedAt: now,
      })
      .where(eq(payments.id, paymentRecord.id));

    if (payment.status === "captured" && order.status === "paid") {
      const entitlement = await activateSelfPaidProEntitlement({
        tenantId,
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
      });

      return NextResponse.json({
        success: true,
        payment_id: payment.id,
        order_id: orderId,
        entitlement,
      });
    }

    return NextResponse.json({
      success: true,
      payment_id: payment.id,
      order_id: orderId,
      payment_status: payment.status,
      message: "Payment signature verified. Access will be activated after capture.",
    });
  } catch (error) {
    console.error("[Razorpay Verify Payment]", error);

    if (error instanceof RazorpayApiError && error.status === 401) {
      return NextResponse.json(
        { error: "Razorpay authentication failed. Check the API credentials." },
        { status: 401 },
      );
    }

    if (error instanceof RazorpayApiError) {
      return NextResponse.json(
        { error: "Unable to verify the Razorpay payment status." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to verify Razorpay payment." },
      { status: 500 },
    );
  }
}
