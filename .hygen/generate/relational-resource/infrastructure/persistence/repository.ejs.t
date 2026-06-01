---
to: src/modules/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/persistence/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository.ts
---
import { NullableType } from '@/common/utils/types/nullable.type';
import { DeepPartial } from '@/common/utils/types/deep-partial.type';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';
import { <%= name %> } from '../../domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>';

export abstract class <%= name %>Repository {
  abstract create(
    data: Omit<<%= name %>, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<<%= name %>>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<<%= name %>[]>;

  abstract findById(id: <%= name %>['id']): Promise<NullableType<<%= name %>>>;

  abstract findByIds(ids: <%= name %>['id'][]): Promise<<%= name %>[]>;

  abstract update(
    id: <%= name %>['id'],
    payload: DeepPartial<<%= name %>>,
  ): Promise<<%= name %> | null>;

  abstract remove(id: <%= name %>['id']): Promise<void>;
}
