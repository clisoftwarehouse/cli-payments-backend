import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentReceivingAccounts1780200000000 implements MigrationInterface {
  name = 'AddPaymentReceivingAccounts1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payment_receiving_account" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "application_id" uuid NOT NULL,
        "method_kind" character varying(16) NOT NULL,
        "bank_code" integer NOT NULL,
        "bank_name" character varying(100) NOT NULL,
        "account_holder" character varying(100) NOT NULL,
        "identity_document" character varying(20) NOT NULL,
        "account_number" character varying(20),
        "account_type" character varying(10),
        "phone" character varying(20),
        "is_active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_receiving_account" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_pra_application" ON "payment_receiving_account" ("application_id", "method_kind", "is_active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_pra_application"`);
    await queryRunner.query(`DROP TABLE "payment_receiving_account"`);
  }
}
