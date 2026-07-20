import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Una referencia bancaria solo puede acreditarse UNA vez por aplicación.
 *
 * El índice es PARCIAL (solo pagos liquidados) a propósito: los intentos fallidos con la
 * misma referencia — typos, reintentos tras un rechazo de Sitef — no deben bloquear el
 * intento bueno. Y solo el liquidado representa dinero ya acreditado.
 */
export class AddPaymentReferenceUniqueness1780400000000 implements MigrationInterface {
  name = 'AddPaymentReferenceUniqueness1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment" ADD COLUMN "payment_reference" character varying(32)`);

    // Backfill de lo ya liquidado: sin esto, un pago histórico no protegería contra que su
    // referencia se reutilice ahora. Se toman los últimos 8 dígitos de method_data para
    // igualar la normalización del adapter (toPaymentReference).
    await queryRunner.query(`
      UPDATE "payment"
      SET "payment_reference" = RIGHT(REGEXP_REPLACE("method_data" ->> 'paymentReference', '\\D', '', 'g'), 8)
      WHERE "method_data" ->> 'paymentReference' IS NOT NULL
        AND REGEXP_REPLACE("method_data" ->> 'paymentReference', '\\D', '', 'g') <> ''
    `);

    // Si el histórico ya trae duplicados liquidados (el bug que motiva esta migración),
    // crear el índice fallaría y tumbaría el deploy. Se conserva el más antiguo —el cobro
    // legítimo— y se libera el resto, que queda auditado en method_data + payment_attempts.
    await queryRunner.query(`
      UPDATE "payment" p
      SET "payment_reference" = NULL
      WHERE p."status" = 'succeeded'
        AND p."payment_reference" IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM "payment" q
          WHERE q."application_id" = p."application_id"
            AND q."payment_reference" = p."payment_reference"
            AND q."status" = 'succeeded'
            AND (q."createdAt", q."id") < (p."createdAt", p."id")
        )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payment_reference_settled"
      ON "payment" ("application_id", "payment_reference")
      WHERE "status" = 'succeeded' AND "payment_reference" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_payment_reference_settled"`);
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "payment_reference"`);
  }
}
