import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * `method_kinds`: métodos de pago que atiende cada terminal Sitef. NULL/vacío = terminal por
 * defecto (atiende todo método sin terminal específico) — los terminales existentes quedan como
 * default, así que el comportamiento actual no cambia hasta que el admin asigne métodos.
 */
export class AddTerminalMethodKinds1780600000000 implements MigrationInterface {
  name = 'AddTerminalMethodKinds1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "merchant_terminal" ADD COLUMN "method_kinds" text[]`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "merchant_terminal" DROP COLUMN "method_kinds"`);
  }
}
