import { Logger, Injectable, OnModuleInit } from '@nestjs/common';

import { OutboxEvent } from '@/modules/outbox/domain/outbox-event';
import { MailerService } from '@/modules/mailer/mailer.service';
import { CustomersService } from '@/modules/customers/customers.service';
import { ApplicationsService } from '@/modules/applications/applications.service';
import { OutboxInternalHandlerRegistry } from '@/modules/outbox/outbox-internal-handler.registry';

/**
 * Handler interno suscrito a `subscription.renewal_due_{7,3,1}d`. Cuando llega,
 * envía email al customer con el monto a pagar y el deeplink al checkout del SaaS.
 *
 * Se registra en `OutboxInternalHandlerRegistry` bajo el descriptor
 * `renewal_reminder_email`. El caller (subscriptions.service) pasa
 * `internalHandlers: ['renewal_reminder_email']` al hacer `outbox.append()`.
 *
 * Idempotency: el delivery_key incluye la fecha (YYYY-MM-DD) — no se manda dos
 * emails el mismo día aunque el cron se redispare.
 */
@Injectable()
export class RenewalReminderEmailHandler implements OnModuleInit {
  private readonly logger = new Logger(RenewalReminderEmailHandler.name);

  constructor(
    private readonly registry: OutboxInternalHandlerRegistry,
    private readonly mailer: MailerService,
    private readonly customers: CustomersService,
    private readonly applications: ApplicationsService,
  ) {}

  onModuleInit(): void {
    this.registry.register('renewal_reminder_email', (event) => this.handle(event));
  }

  private async handle(event: OutboxEvent): Promise<void> {
    const payload = event.payload as RenewalDuePayload;
    const customer = await this.customers.findById(payload.customer_id);
    if (!customer?.email) {
      this.logger.warn(`Customer ${payload.customer_id} sin email — skip reminder.`);
      return;
    }

    const application = await this.applications.findById(event.applicationId);

    const daysLabel =
      payload.days_to_end === 7
        ? 'en 7 días'
        : payload.days_to_end === 3
          ? 'en 3 días'
          : 'mañana';

    const planLabel = this.formatPlanLabel(payload.product_sku, payload.billing_cycle);

    const subject = `Tu suscripción ${planLabel} vence ${daysLabel}`;
    const html = renderRenewalReminderHtml({
      customerName: customer.fullName,
      applicationName: application.name,
      planLabel,
      daysToEnd: payload.days_to_end,
      currentPeriodEndIso: payload.current_period_end,
    });

    await this.mailer.sendMail({
      to: customer.email,
      subject,
      html,
    });

    this.logger.log(
      `Renewal reminder enviado a ${customer.email} (sub=${payload.subscription_id}, T-${payload.days_to_end}d).`,
    );
  }

  private formatPlanLabel(sku: string, cycle: string): string {
    // ej `vitriona-entrepreneur-monthly` → `Emprendedor (mensual)`.
    // Tolerante: si el SKU no parsea, devuelve el SKU crudo.
    const parts = sku.split('-');
    if (parts.length >= 3) {
      const plan = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      return `${plan} (${cycle === 'annual' ? 'anual' : 'mensual'})`;
    }
    return sku;
  }
}

type RenewalDuePayload = {
  subscription_id: string;
  external_subscription_id: string | null;
  customer_id: string;
  product_id: string;
  product_sku: string;
  billing_cycle: 'monthly' | 'annual';
  current_period_end: string;
  days_to_end: 7 | 3 | 1;
};

type RenderInput = {
  customerName: string;
  applicationName: string;
  planLabel: string;
  daysToEnd: 7 | 3 | 1;
  currentPeriodEndIso: string;
};

function renderRenewalReminderHtml(input: RenderInput): string {
  const endsAt = new Date(input.currentPeriodEndIso).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const urgency =
    input.daysToEnd === 1
      ? 'Tu suscripción vence MAÑANA.'
      : input.daysToEnd === 3
        ? 'Tu suscripción vence en 3 días.'
        : 'Tu suscripción vence en una semana.';

  return `<!doctype html>
<html lang="es">
<body style="font-family: -apple-system, system-ui, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 20px; margin: 0 0 16px;">${escapeHtml(urgency)}</h1>
  <p>Hola ${escapeHtml(input.customerName)},</p>
  <p>Tu suscripción <strong>${escapeHtml(input.planLabel)}</strong> en
    <strong>${escapeHtml(input.applicationName)}</strong> termina el
    <strong>${escapeHtml(endsAt)}</strong>.</p>
  <p>Para continuar sin interrupciones, renueva antes de esa fecha.</p>
  <p style="color: #666; font-size: 13px; margin-top: 32px;">
    Si ya pagaste, ignora este mensaje. El sistema actualiza automáticamente al confirmar el pago.
  </p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
