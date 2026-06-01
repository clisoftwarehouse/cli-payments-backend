import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutboxTables1780000000000 implements MigrationInterface {
  name = 'AddOutboxTables1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbox_event" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "application_id" uuid NOT NULL,
        "aggregate_type" character varying(40) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "event_kind" character varying(80) NOT NULL,
        "delivery_key" character varying(200) NOT NULL,
        "payload" jsonb NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_event" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_outbox_event_delivery_key" UNIQUE ("delivery_key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_event_aggregate" ON "outbox_event" ("aggregate_type", "aggregate_id", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_event_application" ON "outbox_event" ("application_id", "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "outbox_delivery" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "target_type" character varying(20) NOT NULL,
        "target_id" uuid,
        "target_descriptor" character varying(200),
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "next_attempt_at" TIMESTAMP WITH TIME ZONE,
        "last_error_code" character varying(80),
        "last_error_message" text,
        "last_response_status" integer,
        "last_response_body" text,
        "delivered_at" TIMESTAMP WITH TIME ZONE,
        "given_up_at" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_delivery" PRIMARY KEY ("id"),
        CONSTRAINT "FK_outbox_delivery_event" FOREIGN KEY ("event_id") REFERENCES "outbox_event"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    // Sweeper consulta: WHERE status IN ('pending','delivering') AND next_attempt_at <= now()
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_delivery_status_next" ON "outbox_delivery" ("status", "next_attempt_at")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_outbox_delivery_event" ON "outbox_delivery" ("event_id")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_delivery_target" ON "outbox_delivery" ("target_type", "target_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_outbox_delivery_target"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_outbox_delivery_event"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_outbox_delivery_status_next"`);
    await queryRunner.query(`DROP TABLE "outbox_delivery"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_outbox_event_application"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_outbox_event_aggregate"`);
    await queryRunner.query(`DROP TABLE "outbox_event"`);
  }
}
