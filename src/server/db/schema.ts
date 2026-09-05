import {
  pgTable,
  text,
  jsonb,
  timestamp,
  unique,
  boolean,
  index,
  real,
  date,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

export const corsairIntegrations = pgTable("corsair_integrations", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  name: text("name").notNull(),
  config: jsonb("config").notNull().default({}),
  dek: text("dek"),
});

export const corsairAccounts = pgTable("corsair_accounts", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  tenantId: text("tenant_id").notNull(),
  integrationId: text("integration_id")
    .notNull()
    .references(() => corsairIntegrations.id),
  config: jsonb("config").notNull().default({}),
  dek: text("dek"),
});

export const corsairEntities = pgTable("corsair_entities", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  accountId: text("account_id")
    .notNull()
    .references(() => corsairAccounts.id),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  version: text("version").notNull(),
  data: jsonb("data").notNull().default({}),
});

export const corsairEvents = pgTable("corsair_events", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  accountId: text("account_id")
    .notNull()
    .references(() => corsairAccounts.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: text("status"),
});

export const corsairPermissions = pgTable("corsair_permissions", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  token: text("token").notNull(),
  plugin: text("plugin").notNull(),
  endpoint: text("endpoint").notNull(),
  args: text("args").notNull(),
  tenantId: text("tenant_id"),
  status: text("status").notNull().default("pending"),
  expiresAt: text("expires_at").notNull(),
  error: text("error"),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tenant = pgTable("tenant", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, {
        onDelete: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("tenant_members_tenant_user_unique").on(
      table.tenantId,
      table.userId,
    ),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    issuer: text("issuer"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    index("account_userId_idx").on(table.userId),
    unique("account_issuer_accountId_uidx").on(table.issuer, table.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const emailClassifications = pgTable(
  "email_classifications",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    messageId: text("message_id").notNull(),
    priority: text("priority").notNull(), // 'urgent' | 'important' | 'normal' | 'low'
    confidence: real("confidence").notNull(),
    reason: text("reason").notNull(),
    category: text("category"),
    userOverride: boolean("user_override").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("email_classifications_tenant_message_unique").on(
      table.tenantId,
      table.messageId,
    ),
    index("email_classifications_tenant_priority_idx").on(
      table.tenantId,
      table.priority,
    ),
  ],
);

export const emailEmbeddings = pgTable(
  "email_embeddings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    messageId: text("message_id").notNull(),
    embedding: jsonb("embedding").notNull(), // array of 768 floats
    chunkContent: text("chunk_content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("email_embeddings_tenant_message_unique").on(
      table.tenantId,
      table.messageId,
    ),
    index("email_embeddings_tenant_idx").on(table.tenantId),
  ],
);

export const planKeyEnum = pgEnum("plan_key", ["free", "pro"]);

export const billingIntervalEnum = pgEnum("billing_interval", [
  "month",
  "year",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "created",
  "authenticated",
  "active",
  "pending",
  "paused",
  "halted",
  "cancelled",
  "completed",
  "expired",
]);

export const entitlementSourceEnum = pgEnum("entitlement_source", [
  "system",
  "self_paid",
  "admin_granted",
]);

export const entitlementStatusEnum = pgEnum("entitlement_status", [
  "active",
  "revoked",
  "expired",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
]);

export const billingEventStatusEnum = pgEnum("billing_event_status", [
  "pending",
  "processed",
  "failed",
]);

export const plans = pgTable(
  "plans",
  {
    id: text("id").primaryKey(),
    key: planKeyEnum("key").notNull().unique(),
    name: text("name").notNull(),
    priceAmount: integer("price_amount").notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    billingInterval: billingIntervalEnum("billing_interval")
      .notNull()
      .default("month"),
    billingIntervalCount: integer("billing_interval_count")
      .notNull()
      .default(1),
    aiDailyLimit: integer("ai_daily_limit"),
    provider: text("provider").notNull().default("razorpay"),
    providerPlanId: text("provider_plan_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("plans_provider_plan_unique").on(
      table.provider,
      table.providerPlanId,
    ),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    provider: text("provider").notNull().default("razorpay"),
    providerSubscriptionId: text("provider_subscription_id"),
    providerCustomerId: text("provider_customer_id"),
    providerPlanId: text("provider_plan_id"),
    status: subscriptionStatusEnum("status").notNull().default("created"),
    quantity: integer("quantity").notNull().default(1),
    totalCount: integer("total_count"),
    paidCount: integer("paid_count").notNull().default(0),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    startAt: timestamp("start_at", { withTimezone: true }),
    chargeAt: timestamp("charge_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    notes: jsonb("notes").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("subscriptions_provider_subscription_unique").on(
      table.provider,
      table.providerSubscriptionId,
    ),
    index("subscriptions_tenant_idx").on(table.tenantId),
    index("subscriptions_tenant_status_idx").on(table.tenantId, table.status),
    index("subscriptions_provider_customer_idx").on(
      table.provider,
      table.providerCustomerId,
    ),
  ],
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" })
      .unique(),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    source: entitlementSourceEnum("source").notNull(),
    status: entitlementStatusEnum("status").notNull().default("active"),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    grantedByUserId: text("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("entitlements_plan_idx").on(table.planId),
    index("entitlements_status_idx").on(table.status),
    index("entitlements_subscription_idx").on(table.subscriptionId),
  ],
);

export const aiUsageDaily = pgTable(
  "ai_usage_daily",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    usageDate: date("usage_date").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("ai_usage_daily_tenant_date_unique").on(
      table.tenantId,
      table.usageDate,
    ),
    index("ai_usage_daily_tenant_date_idx").on(table.tenantId, table.usageDate),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull().default("razorpay"),
    providerPaymentId: text("provider_payment_id"),
    providerOrderId: text("provider_order_id"),
    providerInvoiceId: text("provider_invoice_id"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: paymentStatusEnum("status").notNull(),
    method: text("method"),
    errorCode: text("error_code"),
    errorDescription: text("error_description"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    rawData: jsonb("raw_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("payments_provider_payment_unique").on(
      table.provider,
      table.providerPaymentId,
    ),
    index("payments_tenant_idx").on(table.tenantId),
    index("payments_subscription_idx").on(table.subscriptionId),
    index("payments_provider_order_idx").on(
      table.provider,
      table.providerOrderId,
    ),
  ],
);

export const billingEvents = pgTable(
  "billing_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull().default("razorpay"),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    status: billingEventStatusEnum("status").notNull().default("pending"),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    payload: jsonb("payload").notNull().default({}),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("billing_events_provider_event_unique").on(
      table.provider,
      table.providerEventId,
    ),
    index("billing_events_provider_type_idx").on(
      table.provider,
      table.eventType,
    ),
    index("billing_events_status_idx").on(table.status),
  ],
);

export const entitlementAuditLogs = pgTable(
  "entitlement_audit_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    entitlementId: text("entitlement_id").references(() => entitlements.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    source: entitlementSourceEnum("source").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("entitlement_audit_logs_tenant_idx").on(table.tenantId),
    index("entitlement_audit_logs_entitlement_idx").on(table.entitlementId),
    index("entitlement_audit_logs_actor_idx").on(table.actorUserId),
  ],
);
