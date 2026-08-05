import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * `return_url`: URL a la que la landing devuelve al cliente tras pagar (o si abandona el checkout).
 * La fija el SaaS por el canal server-to-server (renew con API key), no un query param, así que no
 * es manipulable por el usuario. Nulo para facturas que no vienen de un checkout con retorno.
 */
export class AddInvoiceReturnUrl1780500000000 implements MigrationInterface {
  name = 'AddInvoiceReturnUrl1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoice" ADD COLUMN "return_url" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "return_url"`);
  }
}
