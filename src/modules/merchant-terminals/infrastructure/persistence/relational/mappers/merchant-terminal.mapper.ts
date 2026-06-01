import { MerchantTerminal } from '../../../../domain/merchant-terminal';
import { MerchantTerminalEntity } from '../entities/merchant-terminal.entity';

export class MerchantTerminalMapper {
  static toDomain(raw: MerchantTerminalEntity): MerchantTerminal {
    const d = new MerchantTerminal();
    d.id = raw.id;
    d.applicationId = raw.applicationId;
    d.label = raw.label;
    d.sitefUsername = raw.sitefUsername;
    d.sitefIdBranch = raw.sitefIdBranch;
    d.sitefCodeStall = raw.sitefCodeStall;
    d.acquirerBank = raw.acquirerBank;
    d.isActive = raw.isActive;
    d.notes = raw.notes;
    d.createdAt = raw.createdAt;
    d.updatedAt = raw.updatedAt;
    return d;
  }
}
