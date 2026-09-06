"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowLeft,
  CreditCard,
  Crown,
  DollarSign,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatInrPaise(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "success" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        tone === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        tone === "danger" && "border-destructive/20 bg-destructive/10 text-destructive",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  detail?: string;
}) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {detail && <p className="text-muted-foreground mt-1 text-xs">{detail}</p>}
    </div>
  );
}

export function AdminDashboard() {
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<
    "overview" | "users" | "billing"
  >("overview");
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("");

  const overview = api.admin.getOverview.useQuery();
  const usersQuery = api.admin.getUsers.useQuery(
    { search: search.trim() || undefined },
    { enabled: activeView === "users" },
  );
  const grantPro = api.admin.grantPro.useMutation();
  const revokePro = api.admin.revokePro.useMutation();
  const utils = api.useUtils();

  const users = usersQuery.data ?? [];

  const refreshAdminData = async () => {
    await Promise.all([
      utils.admin.getOverview.invalidate(),
      utils.admin.getUsers.invalidate(),
    ]);
  };

  const handleGrant = async (userId: string) => {
    await grantPro.mutateAsync({
      userId,
      durationDays: duration === "permanent" ? null : Number(duration),
      reason: reason.trim() || undefined,
    });
    setActionUserId(null);
    setReason("");
    await refreshAdminData();
  };

  const handleRevoke = async (userId: string) => {
    if (!window.confirm("Revoke this user's current Pro entitlement?")) return;

    await revokePro.mutateAsync({
      userId,
      reason: reason.trim() || undefined,
    });
    setActionUserId(null);
    setReason("");
    await refreshAdminData();
  };

  const stats = overview.data?.stats;

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border bg-background/95 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Back to dashboard"
              onClick={() => window.location.assign("/dashboard")}
            >
              <ArrowLeft />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary h-4 w-4" />
                <h1 className="text-sm font-semibold">Admin Dashboard</h1>
              </div>
              <p className="text-muted-foreground text-[11px]">
                MailPoint administration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              variant={activeView === "overview" ? "secondary" : "ghost"}
              onClick={() => setActiveView("overview")}
            >
              Overview
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeView === "users" ? "secondary" : "ghost"}
              onClick={() => setActiveView("users")}
            >
              Users
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeView === "billing" ? "secondary" : "ghost"}
              onClick={() => setActiveView("billing")}
            >
              Billing
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {activeView === "overview" && (
          <>
            <section>
              <div className="mb-3">
                <h2 className="text-lg font-semibold">Overview</h2>
                <p className="text-muted-foreground text-sm">
                  Current users, access, and billing activity.
                </p>
              </div>

              {overview.isLoading ? (
                <div className="text-muted-foreground rounded-xl border p-8 text-center text-sm">
                  Loading admin metrics…
                </div>
              ) : overview.error ? (
                <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm">
                  {overview.error.message}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Total Users" value={stats?.users ?? 0} icon={Users} />
                  <StatCard
                    label="Pro Users"
                    value={stats?.pro ?? 0}
                    icon={Crown}
                    detail={`${stats?.selfPaidPro ?? 0} self-paid · ${stats?.adminGrantedPro ?? 0} admin-granted`}
                  />
                  <StatCard
                    label="Captured Revenue"
                    value={formatInrPaise(stats?.capturedRevenuePaise ?? 0)}
                    icon={DollarSign}
                    detail={`${stats?.failedPayments ?? 0} failed payments`}
                  />
                  <StatCard
                    label="Tenants"
                    value={stats?.tenants ?? 0}
                    icon={CreditCard}
                    detail={`${stats?.free ?? 0} active Free`}
                  />
                </div>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="bg-card rounded-xl border">
                <div className="border-b p-4">
                  <h3 className="text-sm font-semibold">Recent Payments</h3>
                </div>
                <div className="divide-border divide-y">
                  {(overview.data?.recentPayments ?? []).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {payment.userName ?? payment.userEmail ?? "Unknown user"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {payment.userEmail ?? "No email"} · {payment.providerOrderId ?? "No order"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium">{formatInrPaise(payment.amount)}</p>
                        <StatusBadge tone={payment.status === "captured" ? "success" : payment.status === "failed" ? "danger" : "warning"}>
                          {payment.status}
                        </StatusBadge>
                      </div>
                    </div>
                  ))}
                  {(overview.data?.recentPayments.length ?? 0) === 0 && (
                    <p className="text-muted-foreground p-4 text-sm">No payments yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-card rounded-xl border">
                <div className="border-b p-4">
                  <h3 className="text-sm font-semibold">Recent Billing Events</h3>
                </div>
                <div className="divide-border divide-y">
                  {(overview.data?.recentEvents ?? []).map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{event.eventType}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {event.providerEventId} · {formatDate(event.createdAt)}
                        </p>
                      </div>
                      <StatusBadge tone={event.status === "processed" ? "success" : event.status === "failed" ? "danger" : "warning"}>
                        {event.status}
                      </StatusBadge>
                    </div>
                  ))}
                  {(overview.data?.recentEvents.length ?? 0) === 0 && (
                    <p className="text-muted-foreground p-4 text-sm">No billing events yet.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="bg-card rounded-xl border">
              <div className="border-b p-4">
                <h3 className="text-sm font-semibold">Recent Entitlement Actions</h3>
              </div>
              <div className="divide-border divide-y">
                {(overview.data?.recentAuditLogs ?? []).map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {log.action} · {log.source}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {log.actorName ?? log.actorEmail ?? "System"} · {log.reason ?? "No reason"}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                ))}
                {(overview.data?.recentAuditLogs.length ?? 0) === 0 && (
                  <p className="text-muted-foreground p-4 text-sm">No entitlement actions yet.</p>
                )}
              </div>
            </section>
          </>
        )}

        {activeView === "billing" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Billing</h2>
              <p className="text-muted-foreground text-sm">
                Recent payments, webhook events, and entitlement changes.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-card rounded-xl border">
                <div className="border-b p-4">
                  <h3 className="text-sm font-semibold">Recent Payments</h3>
                </div>
                <div className="divide-border divide-y">
                  {(overview.data?.recentPayments ?? []).map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {payment.userName ?? payment.userEmail ?? "Unknown user"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {payment.userEmail ?? "No email"} ·{" "}
                          {payment.providerPaymentId ?? "No payment ID"}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px]">
                          {formatDate(payment.paidAt ?? payment.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium">
                          {formatInrPaise(payment.amount)}
                        </p>
                        <StatusBadge
                          tone={
                            payment.status === "captured"
                              ? "success"
                              : payment.status === "failed"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {payment.status}
                        </StatusBadge>
                      </div>
                    </div>
                  ))}
                  {(overview.data?.recentPayments.length ?? 0) === 0 && (
                    <p className="text-muted-foreground p-4 text-sm">
                      No payments yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-card rounded-xl border">
                <div className="border-b p-4">
                  <h3 className="text-sm font-semibold">Webhook Events</h3>
                </div>
                <div className="divide-border divide-y">
                  {(overview.data?.recentEvents ?? []).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {event.eventType}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {event.providerEventId} · {formatDate(event.createdAt)}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px]">
                          Attempts: {event.attemptCount} · Signature:{" "}
                          {event.signatureVerified ? "verified" : "unverified"}
                        </p>
                      </div>
                      <StatusBadge
                        tone={
                          event.status === "processed"
                            ? "success"
                            : event.status === "failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {event.status}
                      </StatusBadge>
                    </div>
                  ))}
                  {(overview.data?.recentEvents.length ?? 0) === 0 && (
                    <p className="text-muted-foreground p-4 text-sm">
                      No webhook events yet.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border">
              <div className="border-b p-4">
                <h3 className="text-sm font-semibold">Entitlement Audit Log</h3>
              </div>
              <div className="divide-border divide-y">
                {(overview.data?.recentAuditLogs ?? []).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {log.action} · {log.source}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {log.actorName ?? log.actorEmail ?? "System"} ·{" "}
                        {log.reason ?? "No reason"}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                ))}
                {(overview.data?.recentAuditLogs.length ?? 0) === 0 && (
                  <p className="text-muted-foreground p-4 text-sm">
                    No entitlement actions yet.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {activeView === "users" && (
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Users</h2>
              <p className="text-muted-foreground text-sm">
                Manage Pro access for MailPoint users.
              </p>
            </div>

            <div className="relative mb-4 max-w-md">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by email"
                className="pl-9"
              />
            </div>

            <div className="bg-card overflow-hidden rounded-xl border">
              {usersQuery.isLoading ? (
                <div className="text-muted-foreground p-8 text-center text-sm">
                  Loading users…
                </div>
              ) : usersQuery.error ? (
                <div className="border-destructive/30 bg-destructive/5 text-destructive m-4 rounded-lg border p-4 text-sm">
                  {usersQuery.error.message}
                </div>
              ) : users.length === 0 ? (
                <div className="text-muted-foreground p-8 text-center text-sm">
                  No users found.
                </div>
              ) : (
                <div className="divide-border divide-y">
                  {users.map((user) => {
                    const isPro = user.planKey === "pro" && user.entitlementStatus === "active";
                    const isAdminGranted =
                      isPro && user.entitlementSource === "admin_granted";

                    return (
                      <div key={user.id} className="p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold">
                                {user.name}
                              </p>
                              {user.isAdmin && <StatusBadge tone="warning">Admin</StatusBadge>}
                              <StatusBadge tone={isPro ? "success" : "neutral"}>
                                {isPro
                                  ? `Pro · ${isAdminGranted ? "Admin granted" : "Self paid"}`
                                  : "Free"}
                              </StatusBadge>
                            </div>
                            <p className="text-muted-foreground truncate text-xs">
                              {user.email}
                            </p>
                            <p className="text-muted-foreground mt-1 text-[11px]">
                              {isPro && user.entitlementEndsAt
                                ? `Access ends ${formatDate(user.entitlementEndsAt)}`
                                : `Joined ${formatDate(user.createdAt)}`}
                            </p>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            {(!isPro || isAdminGranted) && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setActionUserId(
                                    actionUserId === user.id ? null : user.id,
                                  );
                                  setReason("");
                                }}
                              >
                                {isAdminGranted ? "Manage Pro" : "Grant Pro"}
                              </Button>
                            )}
                            {isAdminGranted && (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={revokePro.isPending}
                                onClick={() => void handleRevoke(user.id)}
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>

                        {actionUserId === user.id && (
                          <div className="bg-muted/40 mt-3 rounded-lg border p-3">
                            <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
                              <label className="text-xs font-medium">
                                Duration
                                <select
                                  value={duration}
                                  onChange={(event) => setDuration(event.target.value)}
                                  className="border-input bg-background mt-1 h-8 w-full rounded-md border px-2 text-xs"
                                >
                                  <option value="30">30 days</option>
                                  <option value="90">90 days</option>
                                  <option value="365">1 year</option>
                                  <option value="permanent">No expiry</option>
                                </select>
                              </label>
                              <label className="text-xs font-medium">
                                Reason
                                <Input
                                  value={reason}
                                  onChange={(event) => setReason(event.target.value)}
                                  placeholder="Optional audit reason"
                                  className="mt-1 h-8"
                                />
                              </label>
                              <Button
                                type="button"
                                className="self-end"
                                disabled={grantPro.isPending}
                                onClick={() => void handleGrant(user.id)}
                              >
                                {grantPro.isPending ? "Saving…" : "Grant Pro"}
                              </Button>
                            </div>
                            {grantPro.error && (
                              <p className="text-destructive mt-2 text-xs">
                                {grantPro.error.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
