import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';

import { CryptoService } from '@/modules/crypto/crypto.service';
import { CreateMerchantTerminalDto } from './dto/create-merchant-terminal.dto';
import { MerchantTerminal, MerchantTerminalWithSecret } from './domain/merchant-terminal';
import { MerchantTerminalRepository } from './infrastructure/persistence/merchant-terminal.repository';

@Injectable()
export class MerchantTerminalsService {
  private readonly logger = new Logger(MerchantTerminalsService.name);

  constructor(
    private readonly repository: MerchantTerminalRepository,
    private readonly crypto: CryptoService,
  ) {}

  async create(dto: CreateMerchantTerminalDto): Promise<MerchantTerminal> {
    return this.repository.create({
      applicationId: dto.applicationId,
      label: dto.label,
      sitefUsername: dto.sitefUsername,
      sitefPasswordEncrypted: this.crypto.encrypt(dto.sitefPassword),
      sitefIdBranch: dto.sitefIdBranch,
      sitefCodeStall: dto.sitefCodeStall,
      acquirerBank: dto.acquirerBank,
      notes: dto.notes ?? null,
    });
  }

  async findById(id: string): Promise<MerchantTerminal> {
    const t = await this.repository.findById(id);
    if (!t) throw new NotFoundException('Merchant terminal not found');
    return t;
  }

  async getDecrypted(id: string): Promise<MerchantTerminalWithSecret> {
    const t = await this.findById(id);
    const enc = await this.repository.findEncryptedPasswordById(id);
    if (!enc) throw new NotFoundException('Merchant terminal credentials missing');

    try {
      return { ...t, sitefPassword: this.crypto.decrypt(enc) };
    } catch (err) {
      const prefix = enc.split(':')[0] ?? '(vacío)';
      this.logger.error(
        `Decrypt falló para merchant_terminal id=${id} label="${t.label}" application=${t.applicationId} ` +
          `prefix="${prefix}" length=${enc.length}. Causa: ${(err as Error).message}`,
      );
      throw new InternalServerErrorException(
        `Credenciales del terminal "${t.label}" están corruptas. Re-regístralo vía POST /api/v1/merchant-terminals.`,
      );
    }
  }

  /** Selecciona el primer terminal activo para la aplicación. Sirve para "una sola caja por ahora" — N-ready. */
  async resolveForApplication(applicationId: string): Promise<MerchantTerminalWithSecret> {
    const terminals = await this.repository.findActiveByApplication(applicationId);
    if (terminals.length === 0) {
      throw new NotFoundException(`No hay terminal Sitef activo para la application ${applicationId}.`);
    }
    return this.getDecrypted(terminals[0].id);
  }

  list(applicationId: string) {
    return this.repository.findActiveByApplication(applicationId);
  }

  setActive(id: string, isActive: boolean) {
    return this.repository.setActive(id, isActive);
  }
}
