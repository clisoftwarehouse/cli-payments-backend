---
to: src/modules/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/persistence/relational/repositories/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository.ts
---
import { Repository, In } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { <%= name %> } from '../../../../domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>';
import { <%= name %>Mapper } from '../mappers/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.mapper';
import { <%= name %>Entity } from '../entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity';
import { <%= name %>Repository } from '../../<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository';
import { NullableType } from '@/common/utils/types/nullable.type';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

@Injectable()
export class <%= name %>RelationalRepository implements <%= name %>Repository {
  constructor(
    @InjectRepository(<%= name %>Entity)
    private readonly <%= h.inflection.camelize(name, true) %>Repository: Repository<<%= name %>Entity>,
  ) {}

  async create(data: <%= name %>): Promise<<%= name %>> {
    const persistenceModel = <%= name %>Mapper.toPersistence(data);
    const newEntity = await this.<%= h.inflection.camelize(name, true) %>Repository.save(
      this.<%= h.inflection.camelize(name, true) %>Repository.create(persistenceModel),
    );
    return <%= name %>Mapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<<%= name %>[]> {
    const entities = await this.<%= h.inflection.camelize(name, true) %>Repository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => <%= name %>Mapper.toDomain(entity));
  }

  async findById(id: <%= name %>['id']): Promise<NullableType<<%= name %>>> {
    const entity = await this.<%= h.inflection.camelize(name, true) %>Repository.findOne({
      where: { id },
    });

    return entity ? <%= name %>Mapper.toDomain(entity) : null;
  }

  async findByIds(ids: <%= name %>['id'][]): Promise<<%= name %>[]> {
    const entities = await this.<%= h.inflection.camelize(name, true) %>Repository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => <%= name %>Mapper.toDomain(entity));
  }

  async update(
    id: <%= name %>['id'],
    payload: Partial<<%= name %>>,
  ): Promise<<%= name %>> {
    const entity = await this.<%= h.inflection.camelize(name, true) %>Repository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.<%= h.inflection.camelize(name, true) %>Repository.save(
      this.<%= h.inflection.camelize(name, true) %>Repository.create(
        <%= name %>Mapper.toPersistence({
          ...<%= name %>Mapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return <%= name %>Mapper.toDomain(updatedEntity);
  }

  async remove(id: <%= name %>['id']): Promise<void> {
    await this.<%= h.inflection.camelize(name, true) %>Repository.delete(id);
  }
}
