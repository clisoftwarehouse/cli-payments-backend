import { Bank } from '../../domain/bank';
import { NullableType } from '@/common/utils/types/nullable.type';

export abstract class BankRepository {
  abstract findAllActive(): Promise<Bank[]>;
  abstract findByIbpCode(ibpCode: string): Promise<NullableType<Bank>>;
}
