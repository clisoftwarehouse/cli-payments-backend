import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionTables1779840000000 implements MigrationInterface {
  name = 'AddSubscriptionTables1779840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "application_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "status" character varying(16) NOT NULL,
        "billing_cycle" character varying(16) NOT NULL,
        "current_period_start" TIMESTAMP WITH TIME ZONE NOT NULL,
        "current_period_end" TIMESTAMP WITH TIME ZONE NOT NULL,
        "grace_period_until" TIMESTAMP WITH TIME ZONE,
        "scheduled_product_id" uuid,
        "scheduled_billing_cycle" character varying(16),
        "scheduled_at" TIMESTAMP WITH TIME ZONE,
        "trial_ends_at" TIMESTAMP WITH TIME ZONE,
        "canceled_at" TIMESTAMP WITH TIME ZONE,
        "cancel_reason" text,
        "external_subscription_id" character varying(120),
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_subscription_app_status" ON "subscription" ("application_id", "status")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_subscription_customer" ON "subscription" ("customer_id")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_subscription_external_id" ON "subscription" ("application_id", "external_subscription_id") WHERE "external_subscription_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "subscription_event" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subscription_id" uuid NOT NULL,
        "type" character varying(40) NOT NULL,
        "from_status" character varying(16),
        "to_status" character varying(16),
        "triggered_by" character varying(24) NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_event" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subscription_event_subscription" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_subscription_event_sub" ON "subscription_event" ("subscription_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_subscription_event_sub"`);
    await queryRunner.query(`DROP TABLE "subscription_event"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_subscription_external_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_subscription_customer"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_subscription_app_status"`);
    await queryRunner.query(`DROP TABLE "subscription"`);
  }
}
