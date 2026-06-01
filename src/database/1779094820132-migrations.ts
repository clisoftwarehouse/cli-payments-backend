import { QueryRunner, MigrationInterface } from 'typeorm';

export class Migrations1779094820132 implements MigrationInterface {
  name = 'Migrations1779094820132';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_api_key_application"`);
    await queryRunner.query(`ALTER TABLE "webhook_endpoint" DROP CONSTRAINT "FK_webhook_endpoint_application"`);
    await queryRunner.query(`ALTER TABLE "webhook_delivery" DROP CONSTRAINT "FK_webhook_delivery_endpoint"`);
    await queryRunner.query(`ALTER TABLE "payment_attempt" DROP CONSTRAINT "FK_payment_attempt_payment"`);
    await queryRunner.query(`ALTER TABLE "merchant_terminal" DROP CONSTRAINT "FK_merchant_terminal_application"`);
    await queryRunner.query(`ALTER TABLE "invoice_item" DROP CONSTRAINT "FK_invoice_item_invoice"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_api_key_public_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_application_slug"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_product_sku"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_invoice_number"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_invoice_checkout_token"`);
    await queryRunner.query(
      `CREATE TABLE "subscription" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "product_id" uuid NOT NULL, "status" character varying(16) NOT NULL, "billing_cycle" character varying(16) NOT NULL, "current_period_start" TIMESTAMP WITH TIME ZONE NOT NULL, "current_period_end" TIMESTAMP WITH TIME ZONE NOT NULL, "grace_period_until" TIMESTAMP WITH TIME ZONE, "scheduled_product_id" uuid, "scheduled_billing_cycle" character varying(16), "scheduled_at" TIMESTAMP WITH TIME ZONE, "trial_ends_at" TIMESTAMP WITH TIME ZONE, "canceled_at" TIMESTAMP WITH TIME ZONE, "cancel_reason" text, "external_subscription_id" character varying(120), "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_subscription_external_id" ON "subscription" ("application_id", "external_subscription_id") WHERE "external_subscription_id" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_subscription_customer" ON "subscription" ("customer_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_subscription_app_status" ON "subscription" ("application_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscription_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "from_status" character varying(16), "to_status" character varying(16), "triggered_by" character varying(24) NOT NULL, "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_878b79ef455c948db7f94615990" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_subscription_event_sub" ON "subscription_event" ("subscription_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_77600c71158bb7c002a8bfd98b" ON "api_key" ("public_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2b25e20c70b5908ad52a496d68" ON "application" ("slug") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_34f6ca1cd897cc926bdcca1ca3" ON "product" ("sku") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a575c6d90268739f97737c47e7" ON "invoice" ("number") WHERE "number" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cd7f07494d70a0db84c483bfe0" ON "invoice" ("checkout_token") WHERE "checkout_token" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_event" ADD CONSTRAINT "FK_9aefe091450823da119950f3290" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "payment_attempt" ADD CONSTRAINT "FK_fcc87afb1a6ba0c1e6f70078809" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_terminal" ADD CONSTRAINT "FK_c95fcc576d6f3c50cfedf17fdeb" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_item" ADD CONSTRAINT "FK_9830c1881dd701d440c2164c3cd" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoice_item" DROP CONSTRAINT "FK_9830c1881dd701d440c2164c3cd"`);
    await queryRunner.query(`ALTER TABLE "merchant_terminal" DROP CONSTRAINT "FK_c95fcc576d6f3c50cfedf17fdeb"`);
    await queryRunner.query(`ALTER TABLE "payment_attempt" DROP CONSTRAINT "FK_fcc87afb1a6ba0c1e6f70078809"`);
    await queryRunner.query(`ALTER TABLE "webhook_delivery" DROP CONSTRAINT "FK_f53f5aec02217a54927b13e39d9"`);
    await queryRunner.query(`ALTER TABLE "webhook_endpoint" DROP CONSTRAINT "FK_4c27085a7d0df91f1376485d8a2"`);
    await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_91dedccfd76bc735dfdba0ac616"`);
    await queryRunner.query(`ALTER TABLE "subscription_event" DROP CONSTRAINT "FK_9aefe091450823da119950f3290"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cd7f07494d70a0db84c483bfe0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a575c6d90268739f97737c47e7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_34f6ca1cd897cc926bdcca1ca3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2b25e20c70b5908ad52a496d68"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_77600c71158bb7c002a8bfd98b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_subscription_event_sub"`);
    await queryRunner.query(`DROP TABLE "subscription_event"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_subscription_app_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_subscription_customer"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_subscription_external_id"`);
    await queryRunner.query(`DROP TABLE "subscription"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_invoice_checkout_token" ON "invoice" ("checkout_token") WHERE (checkout_token IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_invoice_number" ON "invoice" ("number") WHERE (number IS NOT NULL)`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_product_sku" ON "product" ("sku") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_application_slug" ON "application" ("slug") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_api_key_public_id" ON "api_key" ("public_id") `);
    await queryRunner.query(
      `ALTER TABLE "invoice_item" ADD CONSTRAINT "FK_invoice_item_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_terminal" ADD CONSTRAINT "FK_merchant_terminal_application" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempt" ADD CONSTRAINT "FK_payment_attempt_payment" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_delivery" ADD CONSTRAINT "FK_webhook_delivery_endpoint" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoint"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "FK_webhook_endpoint_application" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD CONSTRAINT "FK_api_key_application" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
