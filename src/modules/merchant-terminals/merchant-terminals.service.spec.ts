import { MerchantTerminal } from './domain/merchant-terminal';
import { CryptoService } from '@/modules/crypto/crypto.service';
import { MerchantTerminalsService } from './merchant-terminals.service';
import { MerchantTerminalRepository } from './infrastructure/persistence/merchant-terminal.repository';

/**
 * Ruteo de terminales por método de pago. Motivación real: el contrato de Sitef cambia según el
 * banco adquiriente del terminal (débito inmediato Banesco = contrato documentado; Mercantil =
 * dialecto camelCase), y hay comercios con credenciales distintas por método. La resolución debe
 * ser determinista: método específico gana, luego el terminal por defecto.
 */
describe('MerchantTerminalsService — ruteo por método', () => {
  const APP = 'app-1';

  const terminal = (partial: Partial<MerchantTerminal>): MerchantTerminal =>
    Object.assign(new MerchantTerminal(), {
      id: 'id-x',
      applicationId: APP,
      label: 'Terminal',
      sitefUsername: 'cobeca',
      sitefIdBranch: 117,
      sitefCodeStall: '017',
      acquirerBank: 134,
      methodKinds: null,
      isActive: true,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...partial,
    });

  const banesco = terminal({ id: 'id-banesco', label: 'Banesco', acquirerBank: 134, methodKinds: ['c2p'] });
  const mercantil = terminal({ id: 'id-mercantil', label: 'Mercantil', acquirerBank: 105, methodKinds: null });

  let active: MerchantTerminal[];
  let service: MerchantTerminalsService;

  beforeEach(() => {
    active = [banesco, mercantil];
    const repository = {
      findActiveByApplication: jest.fn(() => Promise.resolve(active)),
      findById: jest.fn((id: string) => Promise.resolve(active.find((t) => t.id === id) ?? null)),
      findEncryptedPasswordById: jest.fn(() => Promise.resolve('v1:encrypted')),
      create: jest.fn((data: unknown) => Promise.resolve(data as MerchantTerminal)),
      update: jest.fn(),
      setActive: jest.fn(),
    } as unknown as MerchantTerminalRepository;
    const crypto = {
      encrypt: jest.fn((v: string) => `enc(${v})`),
      decrypt: jest.fn(() => 'clave'),
    } as unknown as CryptoService;

    service = new MerchantTerminalsService(repository, crypto);
  });

  describe('resolveForApplication', () => {
    it('should elegir el terminal que reclama el método', async () => {
      const t = await service.resolveForApplication(APP, 'c2p');
      expect(t.id).toBe('id-banesco');
      expect(t.acquirerBank).toBe(134);
    });

    it('should caer al terminal por defecto cuando ningún terminal reclama el método', async () => {
      const t = await service.resolveForApplication(APP, 'card');
      expect(t.id).toBe('id-mercantil');
    });

    it('should usar el default cuando no se indica método (compat)', async () => {
      const t = await service.resolveForApplication(APP);
      expect(t.id).toBe('id-mercantil');
    });

    it('should usar el primer activo si no hay específico ni default (instalación de una caja)', async () => {
      active = [banesco];
      const t = await service.resolveForApplication(APP, 'transfer');
      expect(t.id).toBe('id-banesco');
    });

    it('should fallar claro si no hay ningún terminal activo', async () => {
      active = [];
      await expect(service.resolveForApplication(APP, 'c2p')).rejects.toThrow(/No hay terminal Sitef activo/);
    });
  });

  describe('validación de conflictos de ruteo', () => {
    const baseDto = {
      applicationId: APP,
      label: 'Nuevo',
      sitefUsername: 'u',
      sitefPassword: 'p',
      sitefIdBranch: 1,
      sitefCodeStall: '001',
      acquirerBank: 105,
    };

    it('should rechazar un segundo terminal por defecto', async () => {
      await expect(service.create({ ...baseDto })).rejects.toThrow(/terminal por defecto activo/);
    });

    it('should rechazar reclamar un método que ya atiende otro terminal activo', async () => {
      await expect(service.create({ ...baseDto, methodKinds: ['c2p'] })).rejects.toThrow(/ya lo atiende/);
    });

    it('should permitir reclamar un método libre', async () => {
      await expect(service.create({ ...baseDto, methodKinds: ['card_ccr'] })).resolves.toBeDefined();
    });

    it('should permitir al editar conservar sus propios métodos (no choca consigo mismo)', async () => {
      await expect(service.update('id-banesco', { methodKinds: ['c2p', 'pago_movil'] })).resolves.toBeUndefined();
    });
  });
});
