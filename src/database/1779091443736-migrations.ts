import { QueryRunner, MigrationInterface } from 'typeorm';

export class Migrations1779091443736 implements MigrationInterface {
  name = 'Migrations1779091443736';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "api_key" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "public_id" character varying(64) NOT NULL, "secret_hash" character varying(255) NOT NULL, "label" character varying(120) NOT NULL, "scopes" text array NOT NULL DEFAULT '{}', "last_used_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_77600c71158bb7c002a8bfd98b" ON "api_key" ("public_id") `);
    await queryRunner.query(
      `CREATE TABLE "application" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(64) NOT NULL, "name" character varying(120) NOT NULL, "mode" character varying(8) NOT NULL DEFAULT 'live', "is_active" boolean NOT NULL DEFAULT true, "website_url" character varying(255), "contact_email" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_569e0c3e863ebdf5f2408ee1670" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2b25e20c70b5908ad52a496d68" ON "application" ("slug") `);
    await queryRunner.query(
      `CREATE TABLE "webhook_endpoint" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "url" character varying(500) NOT NULL, "signing_secret" character varying(255) NOT NULL, "active_events" text array NOT NULL DEFAULT '{}', "is_active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6c98112122b2b8a4f3984d2efa8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_delivery" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "endpoint_id" uuid NOT NULL, "event_type" character varying(64) NOT NULL, "payload" jsonb NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "next_retry_at" TIMESTAMP WITH TIME ZONE, "response_status" integer, "response_body" text, "last_error" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b1ae290239a778f12399db91354" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_endpoint" ON "webhook_delivery" ("endpoint_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_status" ON "webhook_delivery" ("status") `);
    await queryRunner.query(
      `CREATE TABLE "role" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "file" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "path" character varying NOT NULL, CONSTRAINT "PK_36b46d232307066b3a2c9ea3a1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_e12743a7086ec826733f54e1d95" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "email" character varying, "password" character varying, "provider" character varying NOT NULL DEFAULT 'email', "socialId" character varying, "firstName" character varying, "lastName" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "photoId" uuid, "roleId" integer, "statusId" integer, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "REL_75e2be4ce11d447ef43be0e374" UNIQUE ("photoId"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_9bd2fe7a8e694dedc4ec2f666f" ON "user" ("socialId") `);
    await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
    await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
    await queryRunner.query(
      `CREATE TABLE "session" ("id" SERIAL NOT NULL, "hash" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer, CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_3d2f174ef04fb312fdebd0ddc5" ON "session" ("userId") `);
    await queryRunner.query(
      `CREATE TABLE "payment_attempt" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_id" uuid NOT NULL, "status" character varying(24) NOT NULL, "failure_code" character varying(80), "failure_message" text, "otp_state" jsonb, "raw_request" jsonb, "raw_response" jsonb, "next_poll_at" TIMESTAMP WITH TIME ZONE, "poll_count" integer NOT NULL DEFAULT '0', "settled_at" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a5ce3945d1d61956161e7f84d42" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "invoice_id" uuid, "idempotency_key" character varying(80) NOT NULL, "status" character varying(24) NOT NULL DEFAULT 'pending', "method_kind" character varying(16) NOT NULL, "gateway" character varying(16) NOT NULL DEFAULT 'sitef', "gateway_reference" character varying(120), "display_currency" character varying(4) NOT NULL, "display_amount" numeric(12,2) NOT NULL, "fx_rate_source" character varying(24), "fx_rate_used" numeric(14,4), "fx_rate_date" date, "charged_currency" character varying(4), "charged_amount" numeric(14,2), "failure_code" character varying(80), "failure_message" text, "succeeded_at" TIMESTAMP WITH TIME ZONE, "failed_at" TIMESTAMP WITH TIME ZONE, "method_data" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_payment_status" ON "payment" ("status") `);
    await queryRunner.query(`CREATE INDEX "IDX_payment_invoice" ON "payment" ("invoice_id") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payment_idempotency" ON "payment" ("application_id", "idempotency_key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sku" character varying(80) NOT NULL, "name" character varying(160) NOT NULL, "description" text, "kind" character varying(24) NOT NULL, "price_currency" character varying(4) NOT NULL, "price_amount" numeric(12,2) NOT NULL, "billing_interval" character varying(16), "is_active" boolean NOT NULL DEFAULT true, "plan_features" jsonb, "application_id" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_bebc9158e480b949565b4dc7a82" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_34f6ca1cd897cc926bdcca1ca3" ON "product" ("sku") `);
    await queryRunner.query(
      `CREATE TABLE "invoice_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "product_id" uuid, "description" text NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "unit_amount_eur" numeric(12,2) NOT NULL, "line_total_eur" numeric(12,2) NOT NULL, "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_621317346abdf61295516f3cb76" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" character varying(24), "application_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "display_currency" character varying(4) NOT NULL, "display_amount" numeric(12,2) NOT NULL, "fx_rate_source" character varying(24), "fx_rate_used" numeric(14,4), "fx_rate_date" date, "charged_currency" character varying(4), "charged_amount" numeric(14,2), "due_date" date, "paid_at" TIMESTAMP WITH TIME ZONE, "checkout_token" character varying(512), "checkout_token_expires_at" TIMESTAMP WITH TIME ZONE, "pdf_url" text, "notes" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_15d25c200d9bcd8a33f698daf18" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a575c6d90268739f97737c47e7" ON "invoice" ("number") WHERE "number" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cd7f07494d70a0db84c483bfe0" ON "invoice" ("checkout_token") WHERE "checkout_token" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_invoice_customer" ON "invoice" ("customer_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_invoice_application_status" ON "invoice" ("application_id", "status") `);
    await queryRunner.query(
      `CREATE TABLE "fx_rate" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "currency" character varying(8) NOT NULL, "rate" numeric(14,4) NOT NULL, "source" character varying(16) NOT NULL, "effective_date" date NOT NULL, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_172deb302807396e0da8f0aafe0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_fx_rate_currency_date" ON "fx_rate" ("currency", "effective_date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "customer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(320) NOT NULL, "full_name" character varying(240) NOT NULL, "phone" character varying(40), "country" character varying(2) NOT NULL DEFAULT 'VE', "identity_type" character varying(16), "identity_value" character varying(60), "legal_name" character varying(240), "address" text, "default_locale" character varying(8) NOT NULL DEFAULT 'es', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a7a13f4cacb744524e44dfdad32" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_customer_email_country" ON "customer" ("email", "country") `);
    await queryRunner.query(
      `CREATE TABLE "merchant_terminal" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "label" character varying(120) NOT NULL, "sitef_username" character varying(120) NOT NULL, "sitef_password_encrypted" text NOT NULL, "sitef_idbranch" integer NOT NULL, "sitef_codestall" character varying(16) NOT NULL, "acquirer_bank" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "notes" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7fdf7e32aded7591cad071070db" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merchant_terminal_application" ON "merchant_terminal" ("application_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "bank" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ibp_code" character varying(4) NOT NULL, "name" character varying(120) NOT NULL, "short_name" character varying(32) NOT NULL, "c2p_enabled" boolean NOT NULL DEFAULT true, "transfer_enabled" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_28fabb82e66682b2c7e47c03c55" UNIQUE ("ibp_code"), CONSTRAINT "PK_7651eaf705126155142947926e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "counter" ("key" character varying(80) NOT NULL, "value" bigint NOT NULL DEFAULT '0', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_15b5e3de77ab708dc728dea6921" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD CONSTRAINT "FK_91dedccfd76bc735dfdba0ac616" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "FK_4c27085a7d0df91f1376485d8a2" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_delivery" ADD CONSTRAINT "FK_f53f5aec02217a54927b13e39d9" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoint"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_75e2be4ce11d447ef43be0e374f" FOREIGN KEY ("photoId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_dc18daa696860586ba4667a9d31" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempt" ADD CONSTRAINT "FK_fcc87afb1a6ba0c1e6f70078809" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_item" ADD CONSTRAINT "FK_9830c1881dd701d440c2164c3cd" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_terminal" ADD CONSTRAINT "FK_c95fcc576d6f3c50cfedf17fdeb" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "merchant_terminal" DROP CONSTRAINT "FK_c95fcc576d6f3c50cfedf17fdeb"`);
    await queryRunner.query(`ALTER TABLE "invoice_item" DROP CONSTRAINT "FK_9830c1881dd701d440c2164c3cd"`);
    await queryRunner.query(`ALTER TABLE "payment_attempt" DROP CONSTRAINT "FK_fcc87afb1a6ba0c1e6f70078809"`);
    await queryRunner.query(`ALTER TABLE "session" DROP CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_dc18daa696860586ba4667a9d31"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_75e2be4ce11d447ef43be0e374f"`);
    await queryRunner.query(`ALTER TABLE "webhook_delivery" DROP CONSTRAINT "FK_f53f5aec02217a54927b13e39d9"`);
    await queryRunner.query(`ALTER TABLE "webhook_endpoint" DROP CONSTRAINT "FK_4c27085a7d0df91f1376485d8a2"`);
    await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_91dedccfd76bc735dfdba0ac616"`);
    await queryRunner.query(`DROP TABLE "counter"`);
    await queryRunner.query(`DROP TABLE "bank"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_merchant_terminal_application"`);
    await queryRunner.query(`DROP TABLE "merchant_terminal"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_customer_email_country"`);
    await queryRunner.query(`DROP TABLE "customer"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_fx_rate_currency_date"`);
    await queryRunner.query(`DROP TABLE "fx_rate"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invoice_application_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invoice_customer"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cd7f07494d70a0db84c483bfe0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a575c6d90268739f97737c47e7"`);
    await queryRunner.query(`DROP TABLE "invoice"`);
    await queryRunner.query(`DROP TABLE "invoice_item"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_34f6ca1cd897cc926bdcca1ca3"`);
    await queryRunner.query(`DROP TABLE "product"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_payment_idempotency"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_invoice"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_status"`);
    await queryRunner.query(`DROP TABLE "payment"`);
    await queryRunner.query(`DROP TABLE "payment_attempt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3d2f174ef04fb312fdebd0ddc5"`);
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f0e1b4ecdca13b177e2e3a0613"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_58e4dbff0e1a32a9bdc861bb29"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9bd2fe7a8e694dedc4ec2f666f"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "status"`);
    await queryRunner.query(`DROP TABLE "file"`);
    await queryRunner.query(`DROP TABLE "role"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_webhook_delivery_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_webhook_delivery_endpoint"`);
    await queryRunner.query(`DROP TABLE "webhook_delivery"`);
    await queryRunner.query(`DROP TABLE "webhook_endpoint"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2b25e20c70b5908ad52a496d68"`);
    await queryRunner.query(`DROP TABLE "application"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_77600c71158bb7c002a8bfd98b"`);
    await queryRunner.query(`DROP TABLE "api_key"`);
  }
}
