import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Query,
  UseGuards,
  Controller,
  ParseUUIDPipe,
  ParseBoolPipe,
} from '@nestjs/common';

import { MerchantTerminal } from './domain/merchant-terminal';
import { MerchantTerminalsService } from './merchant-terminals.service';
import { CreateMerchantTerminalDto } from './dto/create-merchant-terminal.dto';

@ApiTags('Merchant Terminals (admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'merchant-terminals', version: '1' })
export class MerchantTerminalsController {
  constructor(private readonly service: MerchantTerminalsService) {}

  @ApiOperation({
    summary: 'Registrar credenciales Sitef para una application.',
    description: 'El password se encripta AES-256-GCM antes de persistir. Nunca se expone en respuestas.',
  })
  @ApiCreatedResponse({ type: MerchantTerminal })
  @Post()
  create(@Body() dto: CreateMerchantTerminalDto): Promise<MerchantTerminal> {
    return this.service.create(dto);
  }

  @ApiOkResponse({ type: MerchantTerminal, isArray: true })
  @Get()
  list(@Query('applicationId', ParseUUIDPipe) applicationId: string): Promise<MerchantTerminal[]> {
    return this.service.list(applicationId);
  }

  @ApiOkResponse({ type: MerchantTerminal })
  @Patch(':id/active')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('value', ParseBoolPipe) value: boolean,
  ): Promise<MerchantTerminal> {
    return this.service.setActive(id, value);
  }
}
