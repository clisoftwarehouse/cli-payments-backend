import {
  Logger,
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

import { CryptoService } from '@/modules/crypto/crypto.service';
import { CreateMerchantTerminalDto } from './dto/create-merchant-terminal.dto';
import { UpdateMerchantTerminalDto } from './dto/update-merchant-terminal.dto';
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
    await this.assertNoRoutingConflict(dto.applicationId, dto.methodKinds ?? null, null);
    return this.repository.create({
      applicationId: dto.applicationId,
      label: dto.label,
      sitefUsername: dto.sitefUsername,
      sitefPasswordEncrypted: this.crypto.encrypt(dto.sitefPassword),
      sitefIdBranch: dto.sitefIdBranch,
      sitefCodeStall: dto.sitefCodeStall,
      acquirerBank: dto.acquirerBank,
      methodKinds: dto.methodKinds ?? null,
      notes: dto.notes ?? null,
    });
  }

  async update(id: string, dto: UpdateMerchantTerminalDto): Promise<MerchantTerminal> {
    const current = await this.findById(id);
    if (dto.methodKinds !== undefined) {
      await this.assertNoRoutingConflict(current.applicationId, dto.methodKinds, id);
    }
    return this.repository.update(id, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.sitefUsername !== undefined ? { sitefUsername: dto.sitefUsername } : {}),
      // Password omitido = conservar el actual; nunca viaja de vuelta al admin.
      ...(dto.sitefPassword !== undefined && dto.sitefPassword !== ''
        ? { sitefPasswordEncrypted: this.crypto.encrypt(dto.sitefPassword) }
        : {}),
      ...(dto.sitefIdBranch !== undefined ? { sitefIdBranch: dto.sitefIdBranch } : {}),
      ...(dto.sitefCodeStall !== undefined ? { sitefCodeStall: dto.sitefCodeStall } : {}),
      ...(dto.acquirerBank !== undefined ? { acquirerBank: dto.acquirerBank } : {}),
      ...(dto.methodKinds !== undefined ? { methodKinds: dto.methodKinds } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });
  }

  /**
   * El ruteo debe ser determinista: por aplicación, cada método puede estar reclamado por UN
   * solo terminal activo, y solo puede haber UN terminal por defecto (methodKinds vacío).
   * `excludeId` permite re-validar al editar sin chocar contra sí mismo.
   */
  private async assertNoRoutingConflict(
    applicationId: string,
    methodKinds: string[] | null,
    excludeId: string | null,
  ): Promise<void> {
    const others = (await this.repository.findActiveByApplication(applicationId)).filter((t) => t.id !== excludeId);
    const isDefault = !methodKinds || methodKinds.length === 0;

    if (isDefault) {
      const existingDefault = others.find((t) => !t.methodKinds || t.methodKinds.length === 0);
      if (existingDefault) {
        throw new ConflictException(
          `Ya existe un terminal por defecto activo ("${existingDefault.label}"). ` +
            `Asigna métodos específicos a uno de los dos, o desactiva el otro.`,
        );
      }
      return;
    }

    for (const method of methodKinds!) {
      const claimed = others.find((t) => t.methodKinds?.includes(method));
      if (claimed) {
        throw new ConflictException(
          `El método "${method}" ya lo atiende el terminal activo "${claimed.label}". ` +
            `Quítaselo primero o desactiva ese terminal.`,
        );
      }
    }
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

  /**
   * Selecciona el terminal para una operación. Prioridad:
   * 1. Terminal activo que reclama el método (`methodKinds` lo incluye).
   * 2. Terminal por defecto (`methodKinds` vacío/null).
   * 3. Sin método (o sin default): primer terminal activo — compat con instalaciones de una caja.
   *
   * Motivación: el contrato de Sitef cambia según el banco adquiriente del terminal (ej. débito
   * inmediato por Banesco habla el contrato documentado; por Mercantil, el dialecto camelCase),
   * y hay comercios con credenciales distintas por método.
   */
  async resolveForApplication(applicationId: string, method?: string): Promise<MerchantTerminalWithSecret> {
    const terminals = await this.repository.findActiveByApplication(applicationId);
    if (terminals.length === 0) {
      throw new NotFoundException(`No hay terminal Sitef activo para la application ${applicationId}.`);
    }

    const specific = method ? terminals.find((t) => t.methodKinds?.includes(method)) : undefined;
    const fallback = terminals.find((t) => !t.methodKinds || t.methodKinds.length === 0);
    const chosen = specific ?? fallback ?? terminals[0];

    if (method && !specific && !fallback) {
      this.logger.warn(
        `Sin terminal específico ni default para método=${method} app=${applicationId}; ` +
          `usando el primer terminal activo ("${chosen.label}").`,
      );
    }
    return this.getDecrypted(chosen.id);
  }

  list(applicationId: string) {
    return this.repository.findActiveByApplication(applicationId);
  }

  setActive(id: string, isActive: boolean) {
    return this.repository.setActive(id, isActive);
  }
}
