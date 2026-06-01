import { NestFactory } from '@nestjs/core';

import { SeedModule } from './seed.module';
import { BankSeedService } from './bank/bank-seed.service';
import { RoleSeedService } from './role/role-seed.service';
import { UserSeedService } from './user/user-seed.service';
import { StatusSeedService } from './status/status-seed.service';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  await app.get(RoleSeedService).run();
  await app.get(StatusSeedService).run();
  await app.get(UserSeedService).run();
  await app.get(BankSeedService).run();

  await app.close();
};

void runSeed();
