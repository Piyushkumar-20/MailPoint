DO $$ BEGIN
  CREATE TYPE "public"."plan_key" AS ENUM('free', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."subscription_status" AS ENUM('created', 'authenticated', 'active', 'pending', 'paused', 'halted', 'cancelled', 'completed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."entitlement_source" AS ENUM('system', 'self_paid', 'admin_granted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."entitlement_status" AS ENUM('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."billing_event_status" AS ENUM('pending', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE "plans" (
  "id" text PRIMARY KEY NOT NULL,
  "key" "plan_key" NOT NULL,
  "name" text NOT NULL,
  "price_amount" integer DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'INR' NOT NULL,
  "billing_interval" "billing_interval" DEFAULT 'month' NOT NULL,
  "billing_interval_count" integer DEFAULT 1 NOT NULL,
  "ai_daily_limit" integer,
  "provider" text DEFAULT 'razorpay' NOT NULL,
  "provider_plan_id" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "plans_key_unique" UNIQUE("key"),
  CONSTRAINT "plans_provider_plan_unique" UNIQUE("provider", "provider_plan_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "plan_id" text NOT NULL,
  "provider" text DEFAULT 'razorpay' NOT NULL,
  "provider_subscription_id" text,
  "provider_customer_id" text,
  "provider_plan_id" text,
  "status" "subscription_status" DEFAULT 'created' NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "total_count" integer,
  "paid_count" integer DEFAULT 0 NOT NULL,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "start_at" timestamp with time zone,
  "charge_at" timestamp with time zone,
  "end_at" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "cancelled_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscriptions_provider_subscription_unique" UNIQUE("provider", "provider_subscription_id"),
  CONSTRAINT "subscriptions_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade,
  CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id")
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "plan_id" text NOT NULL,
  "source" "entitlement_source" NOT NULL,
  "status" "entitlement_status" DEFAULT 'active' NOT NULL,
  "subscription_id" text,
  "granted_by_user_id" text,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entitlements_tenant_id_unique" UNIQUE("tenant_id"),
  CONSTRAINT "entitlements_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade,
  CONSTRAINT "entitlements_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id"),
  CONSTRAINT "entitlements_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null,
  CONSTRAINT "entitlements_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "ai_usage_daily" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "usage_date" date NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_usage_daily_tenant_date_unique" UNIQUE("tenant_id", "usage_date"),
  CONSTRAINT "ai_usage_daily_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "payments" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "subscription_id" text,
  "provider" text DEFAULT 'razorpay' NOT NULL,
  "provider_payment_id" text,
  "provider_order_id" text,
  "provider_invoice_id" text,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'INR' NOT NULL,
  "status" "payment_status" NOT NULL,
  "method" text,
  "error_code" text,
  "error_description" text,
  "paid_at" timestamp with time zone,
  "raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payments_provider_payment_unique" UNIQUE("provider", "provider_payment_id"),
  CONSTRAINT "payments_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade,
  CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text DEFAULT 'razorpay' NOT NULL,
  "provider_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "status" "billing_event_status" DEFAULT 'pending' NOT NULL,
  "signature_verified" boolean DEFAULT false NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "billing_events_provider_event_unique" UNIQUE("provider", "provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "entitlement_audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "entitlement_id" text,
  "actor_user_id" text,
  "action" text NOT NULL,
  "source" "entitlement_source" NOT NULL,
  "reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entitlement_audit_logs_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade,
  CONSTRAINT "entitlement_audit_logs_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE set null,
  CONSTRAINT "entitlement_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_idx" ON "subscriptions" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_status_idx" ON "subscriptions" USING btree ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX "subscriptions_provider_customer_idx" ON "subscriptions" USING btree ("provider", "provider_customer_id");
--> statement-breakpoint
CREATE INDEX "entitlements_plan_idx" ON "entitlements" USING btree ("plan_id");
--> statement-breakpoint
CREATE INDEX "entitlements_status_idx" ON "entitlements" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "entitlements_subscription_idx" ON "entitlements" USING btree ("subscription_id");
--> statement-breakpoint
CREATE INDEX "ai_usage_daily_tenant_date_idx" ON "ai_usage_daily" USING btree ("tenant_id", "usage_date");
--> statement-breakpoint
CREATE INDEX "payments_tenant_idx" ON "payments" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "payments_subscription_idx" ON "payments" USING btree ("subscription_id");
--> statement-breakpoint
CREATE INDEX "payments_provider_order_idx" ON "payments" USING btree ("provider", "provider_order_id");
--> statement-breakpoint
CREATE INDEX "billing_events_provider_type_idx" ON "billing_events" USING btree ("provider", "event_type");
--> statement-breakpoint
CREATE INDEX "billing_events_status_idx" ON "billing_events" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "entitlement_audit_logs_tenant_idx" ON "entitlement_audit_logs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "entitlement_audit_logs_entitlement_idx" ON "entitlement_audit_logs" USING btree ("entitlement_id");
--> statement-breakpoint
CREATE INDEX "entitlement_audit_logs_actor_idx" ON "entitlement_audit_logs" USING btree ("actor_user_id");
--> statement-breakpoint
INSERT INTO "plans" ("id", "key", "name", "price_amount", "currency", "billing_interval", "billing_interval_count", "ai_daily_limit", "provider", "is_active")
VALUES
  ('plan_free', 'free', 'Free', 0, 'INR',  'month', 1, 10, 'razorpay', true),
  ('plan_pro', 'pro', 'Pro', 15000, 'INR', 'month', 1, NULL, 'razorpay', true)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price_amount" = EXCLUDED."price_amount",
  "currency" = EXCLUDED."currency",
  "billing_interval" = EXCLUDED."billing_interval",
  "billing_interval_count" = EXCLUDED."billing_interval_count",
  "ai_daily_limit" = EXCLUDED."ai_daily_limit",
  "provider" = EXCLUDED."provider",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "entitlements" ("id", "tenant_id", "plan_id", "source", "status")
SELECT 'entitlement_' || t."id", t."id", 'plan_free', 'system', 'active'
FROM "tenant" t
ON CONFLICT ("tenant_id") DO NOTHING;
