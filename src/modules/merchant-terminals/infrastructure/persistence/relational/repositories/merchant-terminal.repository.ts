import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { NullableType } from '@/common/utils/types/nullable.type';
import { MerchantTerminal } from '../../../../domain/merchant-terminal';
import { MerchantTerminalMapper } from '../mappers/merchant-terminal.mapper';
import { MerchantTerminalEntity } from '../entities/merchant-terminal.entity';
import { MerchantTerminalRepository, MerchantTerminalCreateInput } from '../../merchant-terminal.repository';

@Injectable()
export class MerchantTerminalsRelationalRepository implements MerchantTerminalRepository {
  constructor(
    @InjectRepository(MerchantTerminalEntity)
    private readonly repo: Repository<MerchantTerminalEntity>,
  ) {}

  async create(data: MerchantTerminalCreateInput): Promise<MerchantTerminal> {
    const created = await this.repo.save(this.repo.create(data));
    return MerchantTerminalMapper.toDomain(created);
  }

  async findById(id: string): Promise<NullableType<MerchantTerminal>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? MerchantTerminalMapper.toDomain(entity) : null;
  }

  async findEncryptedPasswordById(id: string): Promise<NullableType<string>> {
    const entity = await this.repo.findOne({ where: { id }, select: ['sitefPasswordEncrypted'] });
    return entity?.sitefPasswordEncrypted ?? null;
  }

  async findActiveByApplication(applicationId: string): Promise<MerchantTerminal[]> {
    const entities = await this.repo.find({
      where: { applicationId, isActive: true },
      order: { createdAt: 'ASC' },
    });
    return entities.map(MerchantTerminalMapper.toDomain);
  }

  async setActive(id: string, isActive: boolean): Promise<MerchantTerminal> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Merchant terminal not found');
    entity.isActive = isActive;
    const saved = await this.repo.save(entity);
    return MerchantTerminalMapper.toDomain(saved);
  }
}
