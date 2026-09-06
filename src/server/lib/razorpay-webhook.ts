import { and, eq, or } from "drizzle-orm";

import { db } from "@/server/db";
import { billingEvents, payments } from "@/server/db/schema";
import {
  activateSelfPaidProEntitlement,
  reconcileSelfPaidProRefund,
} from "@/server/lib/entitlements";

type RazorpayPaymentEntity = {
  id?: unknown;
  order_id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
  method?: unknown;
  error_code?: unknown;
  error_description?: unknown;
  amount_refunded?: unknown;
  refund_status?: unknown;
};

type RazorpayOrderEntity = {
  id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
};

type RazorpayRefundEntity = {
  id?: unknown;
  payment_id?: unknown;
  amount?: unknown;
  status?: unknown;
};

export type RazorpayWebhookEvent = {
  entity?: unknown;
  event?: unknown;
  created_at?: unknown;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    order?: { entity?: RazorpayOrderEntity };
    refund?: { entity?: RazorpayRefundEntity };
  };
};

export type RazorpayWebhookResult = {
  status: "processed" | "ignored";
  message: string;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function eventDate(value: unknown): Date {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000)
    : new Date();
}

function mergeWebhookData(previous: unknown, event: RazorpayWebhookEvent) {
  if (previous && typeof previous === "object" && !Array.isArray(previous)) {
    return {
      ...(previous as Record<string, unknown>),
      lastWebhook: event,
    };
  }

  return { lastWebhook: event };
}

async function findPaymentRecord(params: {
  paymentId?: string | null;
  orderId?: string | null;
}) {
  const conditions = [];

  if (params.paymentId) {
    conditions.push(
      and(
        eq(payments.provider, "razorpay"),
        eq(payments.providerPaymentId, params.paymentId),
      ),
    );
  }

  if (params.orderId) {
    conditions.push(
      and(
        eq(payments.provider, "razorpay"),
        eq(payments.providerOrderId, params.orderId),
      ),
    );
  }

  if (conditions.length === 0) return null;

  const rows = await db
    .select()
    .from(payments)
    .where(or(...conditions))
    .limit(2);

  if (rows.length > 1) {
    throw new Error("Razorpay webhook matched multiple MailPoint payment records.");
  }

  return rows[0] ?? null;
}

async function reconcileSuccessfulPayment(params: {
  event: RazorpayWebhookEvent;
  eventType: "payment.captured" | "order.paid";
}) {
  const paymentEntity = params.event.payload?.payment?.entity;
  const orderEntity = params.event.payload?.order?.entity;

  const paymentId = asString(paymentEntity?.id);
  const orderId =
    asString(paymentEntity?.order_id) ?? asString(orderEntity?.id);
  const amount = asPositiveInteger(paymentEntity?.amount);
  const currency = asString(paymentEntity?.currency);
  const orderAmount = asPositiveInteger(orderEntity?.amount);
  const orderCurrency = asString(orderEntity?.currency);

  if (!paymentId || !orderId) {
    throw new Error(`Razorpay ${params.eventType} payload is missing payment/order identifiers.`);
  }

  const paymentRecord = await findPaymentRecord({ paymentId, orderId });

  if (!paymentRecord) {
    return {
      status: "ignored" as const,
      message: `Ignored ${params.eventType} for an unknown Razorpay order ${orderId}.`,
    };
  }

  if (
    paymentRecord.providerPaymentId &&
    paymentRecord.providerPaymentId !== paymentId
  ) {
    throw new Error("Razorpay payment ID does not match the MailPoint payment record.");
  }

  if (
    paymentRecord.providerOrderId &&
    paymentRecord.providerOrderId !== orderId
  ) {
    throw new Error("Razorpay order ID does not match the MailPoint payment record.");
  }

  if (
    (amount !== null && amount !== paymentRecord.amount) ||
    (orderAmount !== null && orderAmount !== paymentRecord.amount) ||
    (currency !== null && currency !== paymentRecord.currency) ||
    (orderCurrency !== null && orderCurrency !== paymentRecord.currency)
  ) {
    throw new Error("Razorpay webhook amount or currency does not match the MailPoint payment.");
  }

  const now = new Date();
  const paidAt = eventDate(params.event.created_at);

  await db
    .update(payments)
    .set({
      providerPaymentId: paymentId,
      status: "captured",
      method: asString(paymentEntity?.method),
      errorCode: null,
      errorDescription: null,
      paidAt,
      rawData: mergeWebhookData(paymentRecord.rawData, params.event),
      updatedAt: now,
    })
    .where(eq(payments.id, paymentRecord.id));

  const entitlement = await activateSelfPaidProEntitlement({
    tenantId: paymentRecord.tenantId,
    paymentId,
    amount: paymentRecord.amount,
    currency: paymentRecord.currency,
  });

  return {
    status: "processed" as const,
    message: `Reconciled ${params.eventType} and activated Pro entitlement for tenant ${paymentRecord.tenantId}.`,
    entitlement,
  };
}

async function reconcileFailedPayment(event: RazorpayWebhookEvent) {
  const paymentEntity = event.payload?.payment?.entity;
  const paymentId = asString(paymentEntity?.id);
  const orderId = asString(paymentEntity?.order_id);

  if (!paymentId && !orderId) {
    throw new Error("Razorpay payment.failed payload is missing payment/order identifiers.");
  }

  const paymentRecord = await findPaymentRecord({ paymentId, orderId });

  if (!paymentRecord) {
    return {
      status: "ignored" as const,
      message: "Ignored payment.failed for an unknown MailPoint payment.",
    };
  }

  if (paymentRecord.status === "captured" || paymentRecord.status === "refunded") {
    return {
      status: "processed" as const,
      message: "Ignored an out-of-order payment.failed event because the payment is already captured/refunded.",
    };
  }

  await db
    .update(payments)
    .set({
      providerPaymentId: paymentId ?? paymentRecord.providerPaymentId,
      status: "failed",
      errorCode: asString(paymentEntity?.error_code),
      errorDescription: asString(paymentEntity?.error_description),
      rawData: mergeWebhookData(paymentRecord.rawData, event),
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentRecord.id));

  return {
    status: "processed" as const,
    message: `Reconciled payment.failed for payment ${paymentId ?? paymentRecord.id}.`,
  };
}

async function reconcileRefund(event: RazorpayWebhookEvent) {
  const refund = event.payload?.refund?.entity;
  const paymentEntity = event.payload?.payment?.entity;
  const paymentId =
    asString(refund?.payment_id) ?? asString(paymentEntity?.id);

  if (!paymentId) {
    throw new Error("Razorpay refund webhook is missing payment_id.");
  }

  const paymentRecord = await findPaymentRecord({ paymentId });

  if (!paymentRecord) {
    return {
      status: "ignored" as const,
      message: "Ignored refund webhook for an unknown MailPoint payment.",
    };
  }

  const amount = asPositiveInteger(paymentEntity?.amount) ?? paymentRecord.amount;
  const amountRefunded = asPositiveInteger(paymentEntity?.amount_refunded) ?? 0;
  const isFullyRefunded = amountRefunded >= amount;

  await db
    .update(payments)
    .set({
      status: isFullyRefunded ? "refunded" : paymentRecord.status,
      rawData: mergeWebhookData(paymentRecord.rawData, event),
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentRecord.id));

  if (isFullyRefunded) {
    await reconcileSelfPaidProRefund({
      tenantId: paymentRecord.tenantId,
      paymentId,
    });
  }

  return {
    status: "processed" as const,
    message: isFullyRefunded
      ? `Reconciled full refund for payment ${paymentId}.`
      : `Recorded partial refund activity for payment ${paymentId}.`,
  };
}

export async function processRazorpayWebhookEvent(
  event: RazorpayWebhookEvent,
): Promise<RazorpayWebhookResult> {
  const eventType = asString(event.event);

  switch (eventType) {
    case "payment.captured":
      return reconcileSuccessfulPayment({ event, eventType });
    case "order.paid":
      return reconcileSuccessfulPayment({ event, eventType });
    case "payment.failed":
      return reconcileFailedPayment(event);
    case "refund.created":
    case "refund.processed":
      return reconcileRefund(event);
    case "refund.failed":
      return {
        status: "processed",
        message: "Recorded refund.failed webhook without changing payment access.",
      };
    default:
      return {
        status: "ignored",
        message: `Ignored unsupported Razorpay event ${eventType ?? "unknown"}.`,
      };
  }
}

export async function recordAndProcessRazorpayWebhook(params: {
  providerEventId: string;
  eventType: string;
  payload: RazorpayWebhookEvent;
}) {
  const existing = await db.query.billingEvents.findFirst({
    where: and(
      eq(billingEvents.provider, "razorpay"),
      eq(billingEvents.providerEventId, params.providerEventId),
    ),
  });

  if (existing?.status === "processed") {
    return {
      duplicate: true,
      result: {
        status: "processed" as const,
        message: "Razorpay webhook event was already processed.",
      },
    };
  }

  if (existing?.status === "pending") {
    throw new Error("Razorpay webhook event is already being processed.");
  }

  if (existing?.status === "failed") {
    await db
      .update(billingEvents)
      .set({
        status: "pending",
        attemptCount: existing.attemptCount + 1,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(billingEvents.id, existing.id));
  } else {
    await db.insert(billingEvents).values({
      id: crypto.randomUUID(),
      provider: "razorpay",
      providerEventId: params.providerEventId,
      eventType: params.eventType,
      status: "pending",
      signatureVerified: true,
      payload: params.payload,
      attemptCount: 1,
    });
  }

  try {
    const result = await processRazorpayWebhookEvent(params.payload);

    await db
      .update(billingEvents)
      .set({
        status: "processed",
        processedAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(billingEvents.provider, "razorpay"),
          eq(billingEvents.providerEventId, params.providerEventId),
        ),
      );

    return { duplicate: false, result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown webhook processing error.";

    await db
      .update(billingEvents)
      .set({
        status: "failed",
        error: message,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(billingEvents.provider, "razorpay"),
          eq(billingEvents.providerEventId, params.providerEventId),
        ),
      );

    throw error;
  }
}
