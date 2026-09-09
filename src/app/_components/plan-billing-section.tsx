"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Sparkles,
  X,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Razorpay checkout types
// ---------------------------------------------------------------------------

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
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: { error?: { description?: string } }) => void,
  ) => void;
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
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

/** Format paise → "₹150" (INR) or generic amount/currency string. */
function formatPrice(amountPaise: number, currency: string): string {
  if (currency === "INR") {
    return `₹${(amountPaise / 100).toLocaleString("en-IN")}`;
  }
  return `${currency} ${(amountPaise / 100).toLocaleString()}`;
}

/** Format billing interval for display, e.g. "month" → "month". */
function formatInterval(
  interval: string,
  count: number,
): string {
  if (count === 1) return interval;
  return `${count} ${interval}s`;
}

// ---------------------------------------------------------------------------
// Feature list definitions
// These describe actual MailPoint capabilities — Free vs Pro.
// Limits that come from the DB (aiDailyLimit) are injected at render time.
// ---------------------------------------------------------------------------

type FeatureEntry =
  | { type: "included"; label: string }
  | { type: "limited"; label: string; detail: string }
  | { type: "excluded"; label: string };

function buildFreeFeatures(aiDailyLimit: number | null): FeatureEntry[] {
  return [
    { type: "included", label: "Gmail inbox access" },
    { type: "included", label: "Google Calendar integration" },
    { type: "included", label: "Priority classification" },
    { type: "included", label: "Smart keyword search" },
    {
      type: "limited",
      label: "MailPoint AI",
      detail:
        aiDailyLimit !== null
          ? `${aiDailyLimit} AI request${aiDailyLimit === 1 ? "" : "s"} per day`
          : "Limited AI usage",
    },
    { type: "excluded", label: "Unlimited AI requests" },
    { type: "excluded", label: "Semantic email search" },
  ];
}

function buildProFeatures(aiDailyLimitFree: number | null): FeatureEntry[] {
  return [
    { type: "included", label: "Everything in Free" },
    { type: "included", label: "Unlimited AI requests" },
    { type: "included", label: "Semantic email search" },
    {
      type: "included",
      label: "Full MailPoint AI capabilities",
    },
    {
      type: "included",
      label: aiDailyLimitFree !== null
        ? `vs. ${aiDailyLimitFree}/day on Free`
        : "Unrestricted AI usage",
    },
  ];
}

// ---------------------------------------------------------------------------
// Feature row
// ---------------------------------------------------------------------------

function FeatureRow({ feature }: { feature: FeatureEntry }) {
  return (
    <li className="flex items-start gap-2.5 py-0.5">
      {feature.type === "included" && (
        <Check
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
          aria-hidden="true"
        />
      )}
      {feature.type === "limited" && (
        <Minus
          className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />
      )}
      {feature.type === "excluded" && (
        <X
          className="text-muted-foreground/50 mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          "text-sm leading-snug",
          feature.type === "excluded" && "text-muted-foreground/60",
        )}
      >
        {feature.label}
        {feature.type === "limited" && (
          <span className="text-muted-foreground ml-1 text-xs">
            ({feature.detail})
          </span>
        )}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Subscription summary (shown inside Pro card when user is on Pro)
// ---------------------------------------------------------------------------

function ProSubscriptionSummary({
  source,
  endsAt,
}: {
  source: string;
  endsAt: Date | null;
}) {
  return (
    <div className="bg-muted/50 rounded-lg border p-3 text-xs space-y-1.5">
      <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        Active subscription
      </div>

      <dl className="space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">Active</dd>
        </div>

        {endsAt && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Active until</dt>
            <dd className="font-medium">
              {new Date(endsAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
        )}

        {source === "self_paid" && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Payment provider</dt>
            <dd className="font-medium">Razorpay</dd>
          </div>
        )}

        {source === "admin_granted" && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Access type</dt>
            <dd className="font-medium">Complimentary</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan & Billing section
// ---------------------------------------------------------------------------

export function PlanBillingSection({
  user,
}: {
  user: { name?: string | null; email?: string | null } | null;
}) {
  const entitlementQuery = api.billing.getEntitlement.useQuery();
  const plansQuery = api.billing.getPlans.useQuery();

  const [isUpgrading, setIsUpgrading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entitlement = entitlementQuery.data?.entitlement;
  const freePlan = plansQuery.data?.freePlan;
  const proPlan = plansQuery.data?.proPlan;

  const isPro =
    entitlement?.planKey === "pro" && entitlement?.status === "active";
  const isLoading = entitlementQuery.isLoading || plansQuery.isLoading;

  // ---------------------------------------------------------------------------
  // Upgrade handler — uses existing Razorpay checkout flow unchanged
  // ---------------------------------------------------------------------------

  const handleUpgrade = async () => {
    setIsUpgrading(true);
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
        throw new Error(createData.error ?? "Unable to create the Razorpay order.");
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
              const verifyResponse = await fetch("/api/billing/verify-payment", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              });

              const verifyData = (await verifyResponse.json()) as {
                success?: boolean;
                error?: string;
                message?: string;
              };

              if (!verifyResponse.ok || !verifyData.success) {
                throw new Error(verifyData.error ?? "Payment verification failed.");
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
              setIsUpgrading(false);
            }
          })();
        },

        modal: {
          ondismiss: () => {
            setMessage("Payment cancelled. No changes were made to your plan.");
            setIsUpgrading(false);
          },
        },
      });

      razorpay.on("payment.failed", (response) => {
        setError(
          response.error?.description ??
            "Razorpay could not complete the payment. Please try again.",
        );
        setIsUpgrading(false);
      });

      razorpay.open();
    } catch (upgradeError) {
      setError(
        upgradeError instanceof Error
          ? upgradeError.message
          : "Unable to start the payment.",
      );
      setIsUpgrading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <section aria-labelledby="plan-billing-heading">
        <h2 id="plan-billing-heading" className="font-heading text-2xl font-semibold">
          Plan &amp; Billing
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose the MailPoint plan that fits your workflow.
        </p>
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading plan details…
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Feature lists — built from real plan data
  // ---------------------------------------------------------------------------

  const freeFeatures = buildFreeFeatures(freePlan?.aiDailyLimit ?? null);
  const proFeatures = buildProFeatures(freePlan?.aiDailyLimit ?? null);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section aria-labelledby="plan-billing-heading">
      <h2 id="plan-billing-heading" className="font-heading text-2xl font-semibold">
        Plan &amp; Billing
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Choose the MailPoint plan that fits your workflow.
      </p>

      {/* Plan cards — side-by-side on md+, stacked on mobile */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* ── Free card ── */}
        <Card
          className={cn(
            "relative flex flex-col",
            !isPro && "ring-2 ring-primary",
          )}
          aria-label="Free plan"
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Free</CardTitle>
              {!isPro && (
                <Badge variant="default" className="shrink-0 text-[11px]">
                  Current plan
                </Badge>
              )}
            </div>

            <div className="mt-1">
              <span className="text-2xl font-bold">
                {freePlan ? formatPrice(freePlan.priceAmount, freePlan.currency) : "₹0"}
              </span>
              <span className="text-muted-foreground text-sm">
                {" "}
                /{" "}
                {freePlan
                  ? formatInterval(freePlan.billingInterval, freePlan.billingIntervalCount)
                  : "month"}
              </span>
            </div>

            <p className="text-muted-foreground text-sm">
              For getting started with MailPoint.
            </p>
          </CardHeader>

          <CardContent className="flex-1">
            <ul className="space-y-0.5" aria-label="Free plan features">
              {freeFeatures.map((f, i) => (
                <FeatureRow key={i} feature={f} />
              ))}
            </ul>
          </CardContent>

          <CardFooter>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled
              aria-disabled="true"
              aria-label="You are on the Free plan"
            >
              {isPro ? "Free plan" : "Current plan"}
            </Button>
          </CardFooter>
        </Card>

        {/* ── Pro card ── */}
        <Card
          className={cn(
            "relative flex flex-col",
            isPro && "ring-2 ring-primary",
          )}
          aria-label="MailPoint Pro plan"
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
                <CardTitle>MailPoint Pro</CardTitle>
              </div>
              {isPro && (
                <Badge variant="default" className="shrink-0 text-[11px]">
                  Current plan
                </Badge>
              )}
            </div>

            <div className="mt-1">
              <span className="text-2xl font-bold">
                {proPlan
                  ? formatPrice(proPlan.priceAmount, proPlan.currency)
                  : "—"}
              </span>
              <span className="text-muted-foreground text-sm">
                {" "}
                /{" "}
                {proPlan
                  ? formatInterval(proPlan.billingInterval, proPlan.billingIntervalCount)
                  : "month"}
              </span>
            </div>

            <p className="text-muted-foreground text-sm">
              For users who need full MailPoint AI capabilities.
            </p>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            <ul className="space-y-0.5" aria-label="Pro plan features">
              {proFeatures.map((f, i) => (
                <FeatureRow key={i} feature={f} />
              ))}
            </ul>

            {/* Active Pro subscription summary */}
            {isPro && entitlement && (
              <ProSubscriptionSummary
                source={entitlement.source}
                endsAt={entitlement.endsAt}
              />
            )}
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3">
            {!isPro ? (
              <Button
                type="button"
                onClick={handleUpgrade}
                disabled={isUpgrading || !proPlan?.isActive}
                className="w-full"
                aria-label="Upgrade to MailPoint Pro"
              >
                {isUpgrading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Opening Razorpay…
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                    Upgrade to Pro
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled
                aria-disabled="true"
                aria-label="You are on MailPoint Pro"
              >
                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" aria-hidden="true" />
                Manage subscription
              </Button>
            )}

            {/* Status messages */}
            {message && (
              <p className="text-muted-foreground text-xs" role="status">
                {message}
              </p>
            )}
            {error && (
              <p className="text-destructive text-xs" role="alert">
                {error}
              </p>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* AI usage comparison callout */}
      {freePlan && (
        <div className="bg-muted/40 border-border mt-4 rounded-lg border p-4">
          <h3 className="text-sm font-medium">AI usage</h3>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Free
              </p>
              <p className="mt-0.5">
                {freePlan.aiDailyLimit !== null
                  ? `${freePlan.aiDailyLimit} request${freePlan.aiDailyLimit === 1 ? "" : "s"} / day`
                  : "Unlimited"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Pro
              </p>
              <p className="mt-0.5 font-medium">
                Unlimited
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
