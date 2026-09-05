import { env } from "@/env";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RazorpayApiError";
  }
}

function getAuthorizationHeader() {
  return `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
}

async function razorpayRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthorizationHeader(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const raw = await response.text();
  let data: unknown;

  try {
    data = raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const description =
      data && typeof data === "object"
        ? (data as { error?: { description?: unknown } }).error?.description
        : undefined;

    throw new RazorpayApiError(
      typeof description === "string"
        ? description
        : `Razorpay API request failed with status ${response.status}.`,
      response.status,
    );
  }

  return data as T;
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
};

export async function createRazorpayOrder(params: {
  amount: number;
  currency: string;
  receipt: string;
}): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
    }),
  });
}

export async function getRazorpayOrder(orderId: string) {
  return razorpayRequest<RazorpayOrder>(`/orders/${encodeURIComponent(orderId)}`);
}

export async function getRazorpayPayment(paymentId: string) {
  return razorpayRequest<RazorpayPayment>(
    `/payments/${encodeURIComponent(paymentId)}`,
  );
}
