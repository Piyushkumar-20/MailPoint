"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import { CalendarDays, Mail, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PluginKey = "gmail" | "googlecalendar";

const INTEGRATIONS: {
  plugin: PluginKey;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    plugin: "gmail",
    title: "Gmail",
    description: "Mail sync, reading, drafts, and sending.",
    icon: Mail,
  },
  {
    plugin: "googlecalendar",
    title: "Google Calendar",
    description: "Calendar sync, event creation, and invitations.",
    icon: CalendarDays,
  },
];

function statusCopy(state: string | undefined, loading: boolean, error: boolean) {
  if (loading) return "Checking";
  if (error) return "Connection issue";
  if (state === "connected") return "Connected";
  if (state === "missing_credentials") return "Missing credentials";
  return "Not connected";
}

function statusTone(state: string | undefined, loading: boolean, error: boolean) {
  if (loading) return "neutral";
  if (error || state !== "connected") return "error";
  return "success";
}

function StatusBadge({
  state,
  loading,
  error,
}: {
  state: string | undefined;
  loading: boolean;
  error: boolean;
}) {
  const tone = statusTone(state, loading, error);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-2 rounded-full",
          tone === "success" && "bg-emerald-500",
          tone === "error" && "bg-destructive",
          tone === "neutral" && "bg-muted-foreground",
        )}
      />
      {statusCopy(state, loading, error)}
    </span>
  );
}

export function IntegrationsPanel({
  accountEmail,
}: {
  accountEmail?: string | null;
}) {
  const connections = api.gmail.checkConnection.useQuery();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectGoogle = async () => {
    try {
      setConnectError(null);
      setIsConnecting(true);

      const response = await fetch("/api/corsair/connect", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to create Google connection");
      }

      const data = (await response.json()) as { connectUrl?: string };

      if (!data.connectUrl) {
        throw new Error("Corsair did not return a connection URL");
      }

      window.location.href = data.connectUrl;
    } catch (error) {
      setIsConnecting(false);
      setConnectError(
        error instanceof Error ? error.message : "Failed to connect Google",
      );
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
      <section>
        <h1 className="font-heading text-2xl font-semibold">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the Google services available inside your MailPoint workspace.
        </p>
      </section>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">
            {INTEGRATIONS.filter(
              (item) => connections.data?.[item.plugin] === "connected",
            ).length}{" "}
            successful connections
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Status comes from the existing Corsair connection check.
          </p>
        </div>

        <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
          {INTEGRATIONS.map((integration) => (
            <IntegrationCard
              key={integration.plugin}
              title={integration.title}
              description={integration.description}
              icon={integration.icon}
              state={connections.data?.[integration.plugin]}
              loading={connections.isLoading}
              error={Boolean(connections.error)}
              accountEmail={accountEmail}
              isConnecting={isConnecting}
              onConnect={connectGoogle}
            />
          ))}
        </div>
      </div>

      {(connections.error || connectError) && (
        <p className="text-sm text-destructive">
          {connectError ?? connections.error?.message}
        </p>
      )}
    </div>
  );
}

function IntegrationCard({
  title,
  description,
  icon: Icon,
  state,
  loading,
  error,
  accountEmail,
  isConnecting,
  onConnect,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  state: string | undefined;
  loading: boolean;
  error: boolean;
  accountEmail?: string | null;
  isConnecting: boolean;
  onConnect: () => void;
}) {
  const connected = state === "connected";

  return (
    <Card className="rounded-none border-0 bg-transparent shadow-none ring-0">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <CardAction>
          <StatusBadge state={state} loading={loading} error={error} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 border-y py-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">MailPoint account</dt>
            <dd className="truncate text-right">{accountEmail || "-"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Connection state</dt>
            <dd className="truncate text-right">{statusCopy(state, loading, error)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={connected ? "outline" : "default"}
            onClick={onConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : null}
            {connected ? "Reconnect" : "Connect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
