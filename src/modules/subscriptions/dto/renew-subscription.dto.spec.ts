import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { RenewSubscriptionDto } from './renew-subscription.dto';

/**
 * `returnUrl` es un control de seguridad: la landing redirige el navegador a ese valor tras pagar.
 * Debe aceptar sólo http(s) con protocolo explícito y rechazar esquemas peligrosos (javascript:,
 * data:) que abrirían un XSS/redirect. Es opcional (renovaciones automáticas no lo mandan).
 */
describe('RenewSubscriptionDto — validación de returnUrl', () => {
  const errorsFor = (payload: unknown) => validate(plainToInstance(RenewSubscriptionDto, payload));

  it('should aceptar una URL https', async () => {
    expect(await errorsFor({ returnUrl: 'https://app.vitriona.com/dashboard/billing?checkout=success' })).toHaveLength(
      0,
    );
  });

  it('should aceptar una URL http (dev/local)', async () => {
    expect(await errorsFor({ returnUrl: 'http://localhost:3001/dashboard/billing' })).toHaveLength(0);
  });

  it('should ser opcional: sin returnUrl no hay error', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('should rechazar una URL sin protocolo', async () => {
    expect(await errorsFor({ returnUrl: 'app.vitriona.com/billing' })).not.toHaveLength(0);
  });

  it('should rechazar un string que no es URL', async () => {
    expect(await errorsFor({ returnUrl: 'no-soy-una-url' })).not.toHaveLength(0);
  });

  it('should rechazar el esquema javascript: (anti-XSS)', async () => {
    expect(await errorsFor({ returnUrl: 'javascript:alert(1)' })).not.toHaveLength(0);
  });

  it('should rechazar el esquema data:', async () => {
    expect(await errorsFor({ returnUrl: 'data:text/html,<script>alert(1)</script>' })).not.toHaveLength(0);
  });
});
