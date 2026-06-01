import { Logger, Injectable } from '@nestjs/common';

import { OutboxEvent } from './domain/outbox-event';

export type InternalHandler = (event: OutboxEvent) => Promise<void>;

/**
 * Registry de handlers internos del outbox (vs entrega HTTP a webhook_endpoint).
 *
 * Pattern: cualquier servicio que quiera reaccionar a un evento del outbox sin
 * exponer un endpoint HTTP, registra un handler acá durante `OnModuleInit`. El
 * `OutboxDispatchProcessor` invoca al handler cuando ve una delivery con
 * `target_type=internal_handler` y `target_descriptor=<descriptor>`.
 *
 * Para que un evento llegue al handler, el caller debe pasar `internalHandlers:
 * ['<descriptor>']` al hacer `OutboxService.append()`.
 */
@Injectable()
export class OutboxInternalHandlerRegistry {
  private readonly logger = new Logger(OutboxInternalHandlerRegistry.name);
  private readonly handlers = new Map<string, InternalHandler>();

  register(descriptor: string, handler: InternalHandler): void {
    if (this.handlers.has(descriptor)) {
      this.logger.warn(`Sobrescribiendo handler ya registrado: ${descriptor}`);
    }
    this.handlers.set(descriptor, handler);
    this.logger.log(`Internal handler registrado: ${descriptor}`);
  }

  has(descriptor: string): boolean {
    return this.handlers.has(descriptor);
  }

  async invoke(descriptor: string, event: OutboxEvent): Promise<void> {
    const handler = this.handlers.get(descriptor);
    if (!handler) {
      throw new Error(`No hay handler registrado para descriptor=${descriptor}`);
    }
    await handler(event);
  }

  listDescriptors(): string[] {
    return Array.from(this.handlers.keys());
  }
}
