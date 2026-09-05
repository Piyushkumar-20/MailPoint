"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Sparkles } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
};

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)), {
        once: true,
      });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function BillingCard({
  user,
}: {
  user: { name?: string | null; email?: string | null } | null;
}) {
  const entitlementQuery = api.billing.getEntitlement.useQuery();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entitlement = entitlementQuery.data?.entitlement;
  const isPro = entitlement?.planKey === "pro";

  const handleUpgrade = async () => {
    setIsLoading(true);
    setMessage(null);
    setError(null);

    try {
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Razorpay Checkout could not be loaded. Please check your connection and try again.",
        );
      }

      const createResponse = await fetch("/api/billing/create-order", {
        method: "POST",
        credentials: "include",
      });

      const createData = (await createResponse.json()) as {
        order_id?: string;
        amount?: number;
        currency?: string;
        key_id?: string;
        error?: string;
      };

      if (
        !createResponse.ok ||
        !createData.order_id ||
        !createData.amount ||
        !createData.currency ||
        !createData.key_id
      ) {
        throw new Error(
          createData.error ?? "Unable to create the Razorpay order.",
        );
      }

      const razorpay = new window.Razorpay({
        key: createData.key_id,
        amount: createData.amount,
        currency: createData.currency,
        name: "MailPoint",
        description: "MailPoint Pro — 1 month",
        order_id: createData.order_id,
        prefill: {
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
        },
        theme: { color: "#2563eb" },

        handler: (response) => {
          void (async () => {
            try {
              const verifyResponse = await fetch(
                "/api/billing/verify-payment",
                {
                  method: "POST",
                  credentials: "include",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(response),
                },
              );

              const verifyData = (await verifyResponse.json()) as {
                success?: boolean;
                error?: string;
                message?: string;
              };

              if (!verifyResponse.ok || !verifyData.success) {
                throw new Error(
                  verifyData.error ?? "Payment verification failed.",
                );
              }

              setMessage(
                verifyData.message ??
                  "Payment verified. Your MailPoint Pro access is now active.",
              );

              await entitlementQuery.refetch();
            } catch (verificationError) {
              setError(
                verificationError instanceof Error
                  ? verificationError.message
                  : "Payment verification failed.",
              );
            } finally {
              setIsLoading(false);
            }
          })();
        },

        modal: {
          ondismiss: () => {
            setMessage(
              "Payment cancelled. No changes were made to your plan.",
            );
            setIsLoading(false);
          },
        },
      });

      razorpay.on("payment.failed", (response) => {
        setError(
          response.error?.description ??
            "Razorpay could not complete the payment. Please try again.",
        );
        setIsLoading(false);
      });

      razorpay.open();
    } catch (upgradeError) {
      setError(
        upgradeError instanceof Error
          ? upgradeError.message
          : "Unable to start the payment.",
      );
      setIsLoading(false);
    }
  };

  if (entitlementQuery.isLoading) {
    return (
      <div className="bg-card rounded-lg border p-5">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading billing details…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="text-muted-foreground h-4 w-4" />
            <h2 className="text-sm font-semibold">Plan & Billing</h2>
          </div>

          <p className="text-muted-foreground mt-1 text-xs">
            Manage your MailPoint AI plan.
          </p>
        </div>

        <span className="bg-muted rounded-full px-2.5 py-1 text-xs font-medium">
          {isPro ? "Pro" : "Free"}
        </span>
      </div>

      <div className="mt-5 rounded-md border p-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {isPro ? "MailPoint Pro" : "MailPoint Free"}
            </p>

            <p className="text-muted-foreground mt-1 text-xs">
              {isPro
                ? entitlement?.endsAt
                  ? `Active until ${new Date(
                      entitlement.endsAt,
                    ).toLocaleDateString()}.`
                  : "Active with unlimited product-level AI requests."
                : "10 AI requests per day. Upgrade to Pro for unlimited product-level AI requests."}
            </p>
          </div>
        </div>

        {!isPro && (
          <Button
            type="button"
            onClick={handleUpgrade}
            disabled={isLoading}
            className="mt-4 w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening Razorpay…
              </>
            ) : (
              "Upgrade to Pro — ₹150 / month"
            )}
          </Button>
        )}

        {isPro && entitlement?.source === "self_paid" && (
          <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Paid through Razorpay.
          </div>
        )}
      </div>

      {message && (
        <p className="text-muted-foreground mt-3 text-xs" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="text-destructive mt-3 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}