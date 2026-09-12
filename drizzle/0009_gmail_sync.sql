DO $$ BEGIN
  CREATE TYPE "public"."gmail_sync_status" AS ENUM(
    'initial_sync_required',
    'syncing',
    'synced',
    'sync_error',
    'full_sync_required'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "gmail_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,

  -- Gmail identity
  "message_id" text NOT NULL,
  "thread_id" text NOT NULL DEFAULT '',
  "history_id" text,

  -- List metadata (A) – always populated during sync
  "from_address" text NOT NULL DEFAULT '',
  "to_address" text NOT NULL DEFAULT '',
  "cc_address" text NOT NULL DEFAULT '',
  "subject" text NOT NULL DEFAULT '',
  "snippet" text NOT NULL DEFAULT '',
  "internal_date" text,
  "label_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Derived boolean flags for fast mailbox filtering
  "is_unread" boolean NOT NULL DEFAULT false,
  "is_starred" boolean NOT NULL DEFAULT false,
  "is_inbox" boolean NOT NULL DEFAULT false,
  "is_sent" boolean NOT NULL DEFAULT false,
  "is_trash" boolean NOT NULL DEFAULT false,
  "is_draft" boolean NOT NULL DEFAULT false,

  -- Message body (B) – stored lazily when user opens message
  "body_stored" boolean NOT NULL DEFAULT false,
  "body" text,
  "body_mime_type" text,

  -- Sync bookkeeping
  "synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "gmail_messages_tenant_message_unique"
    UNIQUE ("tenant_id", "message_id"),

  CONSTRAINT "gmail_messages_tenant_id_tenant_id_fk"
    FOREIGN KEY ("tenant_id")
    REFERENCES "public"."tenant"("id")
    ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "gmail_sync_state" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "history_id" text,
  "status" "gmail_sync_status" NOT NULL DEFAULT 'initial_sync_required',
  "last_synced_at" timestamp with time zone,
  "last_error" text,
  "initial_sync_completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "gmail_sync_state_tenant_id_unique"
    UNIQUE ("tenant_id"),

  CONSTRAINT "gmail_sync_state_tenant_id_tenant_id_fk"
    FOREIGN KEY ("tenant_id")
    REFERENCES "public"."tenant"("id")
    ON DELETE cascade
);
--> statement-breakpoint

-- Indexes on gmail_messages
CREATE INDEX IF NOT EXISTS "gmail_messages_tenant_inbox_date_idx"
  ON "gmail_messages" USING btree ("tenant_id", "is_inbox", "internal_date" DESC NULLS LAST);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "gmail_messages_tenant_starred_date_idx"
  ON "gmail_messages" USING btree ("tenant_id", "is_starred", "internal_date" DESC NULLS LAST);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "gmail_messages_tenant_sent_date_idx"
  ON "gmail_messages" USING btree ("tenant_id", "is_sent", "internal_date" DESC NULLS LAST);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "gmail_messages_tenant_trash_date_idx"
  ON "gmail_messages" USING btree ("tenant_id", "is_trash", "internal_date" DESC NULLS LAST);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "gmail_messages_tenant_thread_idx"
  ON "gmail_messages" USING btree ("tenant_id", "thread_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "gmail_messages_tenant_messageid_idx"
  ON "gmail_messages" USING btree ("tenant_id", "message_id");
--> statement-breakpoint

-- Index on gmail_sync_state
CREATE INDEX IF NOT EXISTS "gmail_sync_state_tenant_idx"
  ON "gmail_sync_state" USING btree ("tenant_id");
