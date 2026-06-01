import { QueryRunner, MigrationInterface } from 'typeorm';

export class CliPaymentsSchema1779235200000 implements MigrationInterface {
  name = 'CliPaymentsSchema1779235200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -- application -------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "application" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(64) NOT NULL,
        "name" character varying(120) NOT NULL,
        "mode" character varying(8) NOT NULL DEFAULT 'live',
        "is_active" boolean NOT NULL DEFAULT true,
        "website_url" character varying(255),
        "contact_email" character varying(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_application" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_application_slug" ON "application" ("slug")`);

    // -- api_key -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "api_key" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "application_id" uuid NOT NULL,
        "public_id" character varying(64) NOT NULL,
        "secret_hash" character varying(255) NOT NULL,
        "label" character varying(120) NOT NULL,
        "scopes" text array NOT NULL DEFAULT '{}',
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_key" PRIMARY KEY ("id"),
        CONSTRAINT "FK_api_key_application" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_api_key_public_id" ON "api_key" ("public_id")`);

    // -- webhook_endpoint --------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "webhook_endpoint" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "application_id" uuid NOT NULL,
        "url" character varying(500) NOT NULL,
        "signing_secret" character varying(255) NOT NULL,
        "active_events" text array NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_endpoint" PRIMARY KEY ("id"),
        CONSTRAINT "FK_webhook_endpoint_application" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // -- webhook_delivery --------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "webhook_delivery" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "endpoint_id" uuid NOT NULL,
        "event_type" character varying(64) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "next_retry_at" TIMESTAMP WITH TIME ZONE,
        "response_status" integer,
        "response_body" text,
        "last_error" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_delivery" PRIMARY KEY ("id"),
        CONSTRAINT "FK_webhook_delivery_endpoint" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoint"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_status" ON "webhook_delivery" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_endpoint" ON "webhook_delivery" ("endpoint_id")`);

    // -- customer ----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "customer" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(320) NOT NULL,
        "full_name" character varying(240) NOT NULL,
        "phone" character varying(40),
        "country" character varying(2) NOT NULL DEFAULT 'VE',
        "identity_type" character varying(16),
        "identity_value" character varying(60),
        "legal_name" character varying(240),
        "address" text,
        "default_locale" character varying(8) NOT NULL DEFAULT 'es',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_customer" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_customer_email_country" ON "customer" ("email", "country")`);

    // -- product -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "product" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sku" character varying(80) NOT NULL,
        "name" character varying(160) NOT NULL,
        "description" text,
        "kind" character varying(24) NOT NULL,
        "price_currency" character varying(4) NOT NULL,
        "price_amount" numeric(12,2) NOT NULL,
        "billing_interval" character varying(16),
        "is_active" boolean NOT NULL DEFAULT true,
        "plan_features" jsonb,
        "application_id" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_product" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_product_sku" ON "product" ("sku")`);

    // -- bank --------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "bank" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ibp_code" character varying(4) NOT NULL,
        "name" character varying(120) NOT NULL,
        "short_name" character varying(32) NOT NULL,
        "c2p_enabled" boolean NOT NULL DEFAULT true,
        "transfer_enabled" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bank" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bank_ibp_code" UNIQUE ("ibp_code")
      )
    `);

    // -- counter -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "counter" (
        "key" character varying(80) NOT NULL,
        "value" bigint NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_counter" PRIMARY KEY ("key")
      )
    `);

    // -- fx_rate -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "fx_rate" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "currency" character varying(8) NOT NULL,
        "rate" numeric(14,4) NOT NULL,
        "source" character varying(16) NOT NULL,
        "effective_date" date NOT NULL,
        "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fx_rate" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_fx_rate_currency_date" ON "fx_rate" ("currency", "effective_date")`,
    );

    // -- merchant_terminal -------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "merchant_terminal" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "application_id" uuid NOT NULL,
        "label" character varying(120) NOT NULL,
        "sitef_username" character varying(120) NOT NULL,
        "sitef_password_encrypted" text NOT NULL,
        "sitef_idbranch" integer NOT NULL,
        "sitef_codestall" character varying(16) NOT NULL,
        "acquirer_bank" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_merchant_terminal" PRIMARY KEY ("id"),
        CONSTRAINT "FK_merchant_terminal_application" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_merchant_terminal_application" ON "merchant_terminal" ("application_id")`,
    );

    // -- invoice -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "invoice" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "number" character varying(24),
        "application_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'draft',
        "display_currency" character varying(4) NOT NULL,
        "display_amount" numeric(12,2) NOT NULL,
        "fx_rate_source" character varying(24),
        "fx_rate_used" numeric(14,4),
        "fx_rate_date" date,
        "charged_currency" character varying(4),
        "charged_amount" numeric(14,2),
        "due_date" date,
        "paid_at" TIMESTAMP WITH TIME ZONE,
        "checkout_token" character varying(512),
        "checkout_token_expires_at" TIMESTAMP WITH TIME ZONE,
        "pdf_url" text,
        "notes" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_invoice_number" ON "invoice" ("number") WHERE "number" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_invoice_checkout_token" ON "invoice" ("checkout_token") WHERE "checkout_token" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_invoice_application_status" ON "invoice" ("application_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoice_customer" ON "invoice" ("customer_id")`);

    // -- invoice_item ------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "invoice_item" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoice_id" uuid NOT NULL,
        "product_id" uuid,
        "description" text NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "unit_amount_eur" numeric(12,2) NOT NULL,
        "line_total_eur" numeric(12,2) NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice_item" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invoice_item_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // -- payment -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "payment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "application_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "invoice_id" uuid,
        "idempotency_key" character varying(80) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'pending',
        "method_kind" character varying(16) NOT NULL,
        "gateway" character varying(16) NOT NULL DEFAULT 'sitef',
        "gateway_reference" character varying(120),
        "display_currency" character varying(4) NOT NULL,
        "display_amount" numeric(12,2) NOT NULL,
        "fx_rate_source" character varying(24),
        "fx_rate_used" numeric(14,4),
        "fx_rate_date" date,
        "charged_currency" character varying(4),
        "charged_amount" numeric(14,2),
        "failure_code" character varying(80),
        "failure_message" text,
        "succeeded_at" TIMESTAMP WITH TIME ZONE,
        "failed_at" TIMESTAMP WITH TIME ZONE,
        "method_data" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payment_idempotency" ON "payment" ("application_id", "idempotency_key")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_payment_invoice" ON "payment" ("invoice_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_status" ON "payment" ("status")`);

    // -- payment_attempt ---------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "payment_attempt" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "payment_id" uuid NOT NULL,
        "status" character varying(24) NOT NULL,
        "failure_code" character varying(80),
        "failure_message" text,
        "otp_state" jsonb,
        "raw_request" jsonb,
        "raw_response" jsonb,
        "next_poll_at" TIMESTAMP WITH TIME ZONE,
        "poll_count" integer NOT NULL DEFAULT 0,
        "settled_at" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_attempt" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_attempt_payment" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payment_attempt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_invoice"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_payment_idempotency"`);
    await queryRunner.query(`DROP TABLE "payment"`);
    await queryRunner.query(`DROP TABLE "invoice_item"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invoice_customer"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invoice_application_status"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_invoice_checkout_token"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_invoice_number"`);
    await queryRunner.query(`DROP TABLE "invoice"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_merchant_terminal_application"`);
    await queryRunner.query(`DROP TABLE "merchant_terminal"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_fx_rate_currency_date"`);
    await queryRunner.query(`DROP TABLE "fx_rate"`);
    await queryRunner.query(`DROP TABLE "counter"`);
    await queryRunner.query(`DROP TABLE "bank"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_product_sku"`);
    await queryRunner.query(`DROP TABLE "product"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_customer_email_country"`);
    await queryRunner.query(`DROP TABLE "customer"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_webhook_delivery_endpoint"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_webhook_delivery_status"`);
    await queryRunner.query(`DROP TABLE "webhook_delivery"`);
    await queryRunner.query(`DROP TABLE "webhook_endpoint"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_api_key_public_id"`);
    await queryRunner.query(`DROP TABLE "api_key"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_application_slug"`);
    await queryRunner.query(`DROP TABLE "application"`);
  }
}
