import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import {
  Get,
  Body,
  Post,
  Param,
  Query,
  UseGuards,
  Controller,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
} from '@nestjs/common';

import { Customer } from './domain/customer';
import { CustomersService } from './customers.service';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';

@ApiTags('Customers (admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'Crear o actualizar un cliente por (email, country).' })
  @ApiCreatedResponse({ type: Customer })
  @Post()
  upsert(@Body() dto: UpsertCustomerDto): Promise<Customer> {
    return this.customersService.upsert(dto);
  }

  @ApiOperation({ summary: 'Listar clientes.' })
  @ApiOkResponse({ type: Customer, isArray: true })
  @Get()
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ): Promise<Customer[]> {
    return this.customersService.list({ page, limit, search });
  }

  @ApiOperation({ summary: 'Detalle de cliente.' })
  @ApiOkResponse({ type: Customer })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Customer> {
    return this.customersService.findById(id);
  }
}
