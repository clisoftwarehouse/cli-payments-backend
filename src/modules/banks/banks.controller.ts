import { Get, Controller } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

import { Bank } from './domain/bank';
import { BanksService } from './banks.service';

@ApiTags('Banks (public)')
@Controller({ path: 'public/banks', version: '1' })
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @ApiOperation({ summary: 'Catálogo de bancos venezolanos disponibles (C2P / transferencia).' })
  @ApiOkResponse({ type: Bank, isArray: true })
  @Get()
  list(): Promise<Bank[]> {
    return this.banksService.list();
  }
}
