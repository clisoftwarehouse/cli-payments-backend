import { DataSource } from 'typeorm';
import { Logger, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Garantía de "una sola réplica ejecuta este cron a la vez" usando PG advisory locks.
 *
 * Render puede escalar a >1 instancia. Sin un lock distribuido, todos los crons
 * disparan en cada réplica — doble email, doble webhook, doble UPDATE. Postgres
 * tiene `pg_try_advisory_lock(key)` que es exactamente para esto: lock a nivel
 * de sesión, non-blocking, lo libera al cerrar la conexión o al hacer
 * `pg_advisory_unlock(key)`.
 *
 * Uso:
 *
 *   @Cron(CronExpression.EVERY_HOUR)
 *   async tick() {
 *     await this.leader.run('expire-subscriptions', async () => {
 *       // ... la lógica del cron, solo una réplica la ejecuta
 *     });
 *   }
 *
 * Si otra réplica ya tiene el lock, la actual no espera — solo logea debug y
 * sale. La que tiene el lock corre hasta el final y libera. La siguiente
 * invocación del cron en cualquier réplica vuelve a competir.
 */
@Injectable()
export class CronLeader {
  private readonly logger = new Logger(CronLeader.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Ejecuta `task` si esta réplica gana el advisory lock para `name`.
   * Si otra réplica lo tiene, no-op silencioso.
   */
  async run<T>(name: string, task: () => Promise<T>): Promise<T | null> {
    const key = this.hashToBigint(name);

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const acquired = (await runner.query(
        `SELECT pg_try_advisory_lock($1) AS pg_try_advisory_lock`,
        [key],
      )) as Array<{ pg_try_advisory_lock: boolean }>;
      if (!acquired[0]?.pg_try_advisory_lock) {
        this.logger.debug(`Cron "${name}" skipped: otra réplica tiene el lock.`);
        return null;
      }

      try {
        return await task();
      } finally {
        await runner.query(`SELECT pg_advisory_unlock($1)`, [key]);
      }
    } finally {
      await runner.release();
    }
  }

  /**
   * PG advisory lock toma bigint (signed 64-bit). Hash SHA-256 del nombre y
   * tomamos los primeros 8 bytes como bigint signed.
   */
  private hashToBigint(name: string): string {
    const hash = createHash('sha256').update(name).digest();
    const view = new DataView(hash.buffer, hash.byteOffset, 8);
    const u64 = view.getBigUint64(0);
    // PG bigint es signed; convertimos a signed clamped range.
    const signed = u64 > 0x7fffffffffffffffn ? u64 - 0x10000000000000000n : u64;
    return signed.toString();
  }
}
