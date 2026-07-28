# Checkout centralizado por redirect — Diseño

**Fecha:** 2026-07-28
**Estado:** Aprobado (pendiente implementación)
**Repos afectados:** `cli-payments-backend`, `cli-website` (landing), `Vitriona/vitriona`

## Objetivo

Que **todos** los pagos de los SaaS pasen por el formulario de pago de la landing de CLI,
en vez de que cada SaaS reimplemente el checkout. El SaaS conserva la selección de plan y la
captura de datos fiscales; al momento de **pagar**, redirige el navegador a la landing de CLI
(`/pagar/<token>`), y al terminar el pago la landing devuelve al usuario al SaaS.

Vitriona es el primer integrador. Este redirect-flow queda como el **estándar para todos los
SaaS futuros**.

## Contexto actual (lo que ya existe)

- **Backend** ya expone la tubería SaaS con API key (`X-CLIP-API-Key`):
  - `POST /saas/customers` — upsert de customer (idempotente por email+país).
  - `POST /saas/subscriptions` — crea la suscripción (`trialing` = registrada, pago pendiente).
  - `POST /saas/subscriptions/:id/renew` — emite el Invoice y firma el `checkoutToken`
    (sirve para el primer pago y para renovaciones). Devuelve `{ subscription, invoice }`.
  - `GET /public/checkouts/:token` — la landing resuelve la factura y todos los métodos de pago.
- **Landing** (`cli-website/src/pages/pagar/[token].astro`) ya implementa C2P, transferencia,
  pago móvil y tarjeta (Botón Mercantil), con OTP y polling. **Único archivo de pago.**
- **Vitriona**:
  - `start-cli-payments-upgrade.action.ts` (server action, API key) ya hace: upsert customer →
    create/reuse subscription (`externalSubscriptionId = businessId`) → `renew()` → factura
    `open` con `checkoutToken`. Ya calcula `checkoutUrl` (`checkoutLinkFor(token)`), **pero el
    componente la ignora** y abre el modal inline.
  - El webhook receiver aplica el plan en **`subscription.renewed` → `applyBusinessPlanUpdate()`**.
    `invoice.paid` es no-op. **Esto funciona sin importar dónde se pague.**
  - El modal inline (`checkout-modal.tsx`) + cliente browser (`cli-payments-checkout.ts`) son la
    vía activa hoy — quedan **obsoletos**.

Lo que **no** existe: la landing no sabe volver a un SaaS. No lee ningún return-URL (ni de query
param ni de la factura); en éxito sólo muestra "¡Pago confirmado!" con el link al PDF.

## Decisión de diseño: cómo viaja el return-URL — Opción A

El SaaS manda `returnUrl` en la llamada **`renew()`** (canal server-to-server autenticado con
API key). El backend lo guarda en la factura; el endpoint público lo devuelve; la landing lo lee
de la factura.

**Por qué A y no un query param (`?returnUrl=`):** el query param es manipulable por el usuario
→ open-redirect. Al fijarlo por el canal confiable y guardarlo server-side, el usuario no puede
alterarlo. Es el patrón de las pasarelas serias (Stripe `success_url` viaja en la llamada
autenticada, no en el navegador). Bonus: la factura queda auditable en el admin.

**Endurecimiento futuro (fuera de v1):** validar el host de `returnUrl` contra una allowlist por
aplicación. En v1 basta con validar que sea `https?://` bien formado, porque el único canal que
lo fija es la API key (ya confiable).

## Flujo completo

```
Vitriona (dashboard)                 CLI Payments (backend)         Landing CLI
─────────────────────                ──────────────────────         ───────────
1. Elige plan + ciclo
2. Datos fiscales  ──server action──▶ upsert customer
                                      create/renew subscription
                                      emite invoice + checkoutToken
                                      guarda return_url en invoice
3. window.location = ${LANDING}/pagar/${token} ────────────────────▶ 4. paga (C2P / transf /
                                                                        pago móvil / tarjeta)
                                      invoice.paid ──webhook──▶ (ya existe)
                                      subscription.renewed ──▶ applyBusinessPlanUpdate()
5. ◀── auto-redirect a /dashboard/billing?checkout=success ──────── éxito + botón "Volver"
6. Vitriona lee ?checkout=success → toast + refetch del plan
```

## Cambios por repo

### Backend (`cli-payments-backend`)

- **Data model:** columna `return_url` (text, nullable) en `invoice`. Migración TypeORM.
  - Nota de convención: las timestamps del schema usan camelCase (`createdAt`), el resto
    snake_case. La columna nueva va snake_case (`return_url`) como el resto de columnas de negocio.
- **API SaaS:** `POST /saas/subscriptions/:id/renew` acepta `returnUrl?: string` opcional. Se
  persiste en la factura al emitirla. Sólo `renew()` (no `create`), porque es donde se emite el
  Invoice — tanto en el primer pago (`trialing`) como en las renovaciones.
  - Validación: `returnUrl`, si viene, debe ser una URL `http://` o `https://` bien formada
    (class-validator `@IsUrl` con `require_protocol`). Si es inválida → 400.
- **API pública:** `GET /public/checkouts/:token` incluye `returnUrl` en el response (además de
  los campos actuales del Invoice).
- La propagación va: `renew(dto.returnUrl)` → `invoices.createDraft/issue` guarda `returnUrl` →
  mapper lo expone en el dominio `Invoice` → controller público lo devuelve.

### Landing (`cli-website/src/pages/pagar/[token].astro`)

- Leer `invoice.returnUrl` (nuevo campo del response).
- **Éxito** (`viewSucceeded`): si hay `returnUrl`, mostrar botón "Volver a Vitriona" + auto-redirect
  a los ~3 s con cuenta regresiva (`window.location.href = returnUrl`). Mantener el link al PDF.
  Si no hay `returnUrl`, comportamiento actual (sólo pantalla de éxito).
- **Abandono:** link "Cancelar y volver" durante el flujo → mismo `returnUrl` (si existe).
- No se toca la lógica de métodos de pago / OTP / polling.

### Vitriona (`Vitriona/vitriona`)

- `cli-payments-upgrade-flow.tsx` (Paso 3): en vez de abrir `CheckoutModal`, hacer
  `window.location.href = checkoutUrl` (el server action ya la devuelve).
- Server action `start-cli-payments-upgrade.action.ts` + `cli-payments-client.ts`: pasar
  `returnUrl = ${NEXT_PUBLIC_APP_URL}/dashboard/billing?checkout=success` a `renew()`.
- Env: setear `NEXT_PUBLIC_LANDING_URL` apuntando a la landing de CLI (hoy sólo está
  `CHECKOUT_BASE_URL`); `checkoutLinkFor` ya lo usa como base.
- **Eliminar** obsoletos: `checkout-modal.tsx`, `cli-payments-checkout.ts` (cliente browser),
  y `ve-payment-format.ts` **si sólo lo usa el modal** (verificar imports antes de borrar).
  Quitar sus usos/imports en `cli-payments-upgrade-flow.tsx` y donde aparezcan.
- Página `/dashboard/billing`: leer `?checkout=success` → toast "Confirmando tu pago…" + refetch
  del plan (por si el webhook `subscription.renewed` llega un pelo después del retorno).

### Docs

- Actualizar `CLAUDE.md` / `ROADMAP.md`: documentar el redirect-flow como el estándar de
  integración de pagos para todos los SaaS. Marcar el modal inline como retirado.

## Manejo de errores / bordes

- **Webhook atrasado:** al volver a Vitriona con `?checkout=success`, el plan puede no estar
  aplicado aún. Mitigación: toast "confirmando…" + refetch/breve poll del plan. El webhook sigue
  siendo la fuente de verdad; la UI sólo suaviza la ventana de carrera.
- **`returnUrl` inválida o ausente:** el backend rechaza URLs mal formadas (400). Si la factura no
  trae `returnUrl` (pago no originado por SaaS, ej. landing directa a futuro), la landing usa el
  comportamiento actual sin redirect.
- **Token expirado / factura ya pagada:** comportamiento actual de la landing (pantallas ya
  existentes); no cambia.
- **Doble pago / referencia reusada:** cubierto por el trabajo previo (índice único + guards).

## Testing

- **Unit (backend):** `renew()` guarda `returnUrl` en la factura; el endpoint público lo devuelve;
  la validación rechaza URLs mal formadas.
- **Unit (Vitriona):** el server action arma el `returnUrl` correcto; el Paso 3 redirige a
  `checkoutUrl` (no abre modal).
- **E2E manual (usuario):** ida (Vitriona → landing), pago real con monto bajo, retorno
  (landing → Vitriona), plan actualizado. Se prueba desde la máquina del usuario (como los
  demás pagos contra Sitef real).

## Fuera de alcance (v1)

- Allowlist de hosts de `returnUrl` por aplicación (endurecimiento futuro).
- Flujo público sin token (catálogo en la landing) — no existe hoy y no lo necesita Vitriona.
- Migración de otros SaaS (este diseño es el estándar; se aplican uno a uno después).
