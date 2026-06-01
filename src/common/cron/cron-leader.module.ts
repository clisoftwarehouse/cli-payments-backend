import { Global, Module } from '@nestjs/common';

import { CronLeader } from './cron-leader.service';

/**
 * Global: cualquier módulo con crons puede inyectar `CronLeader` sin importar
 * este módulo explícitamente. Provee el lock distribuido a través de PG advisory.
 */
@Global()
@Module({
  providers: [CronLeader],
  exports: [CronLeader],
})
export class CronLeaderModule {}
