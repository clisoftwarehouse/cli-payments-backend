import { MerchantTerminal } from '../../domain/merchant-terminal';
import { NullableType } from '@/common/utils/types/nullable.type';

export type MerchantTerminalCreateInput = {
  applicationId: string;
  label: string;
  sitefUsername: string;
  sitefPasswordEncrypted: string;
  sitefIdBranch: number;
  sitefCodeStall: string;
  acquirerBank: number;
  methodKinds?: string[] | null;
  notes?: string | null;
};

export type MerchantTerminalUpdateInput = Partial<{
  label: string;
  sitefUsername: string;
  sitefPasswordEncrypted: string;
  sitefIdBranch: number;
  sitefCodeStall: string;
  acquirerBank: number;
  methodKinds: string[] | null;
  notes: string | null;
}>;

export abstract class MerchantTerminalRepository {
  abstract create(data: MerchantTerminalCreateInput): Promise<MerchantTerminal>;
  abstract update(id: string, data: MerchantTerminalUpdateInput): Promise<MerchantTerminal>;
  abstract findById(id: string): Promise<NullableType<MerchantTerminal>>;
  abstract findEncryptedPasswordById(id: string): Promise<NullableType<string>>;
  abstract findActiveByApplication(applicationId: string): Promise<MerchantTerminal[]>;
  abstract setActive(id: string, isActive: boolean): Promise<MerchantTerminal>;
}
