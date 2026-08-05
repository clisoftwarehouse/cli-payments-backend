import { IsUrl, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RenewSubscriptionDto {
  @ApiPropertyOptional({
    example: 'https://app.vitriona.com/dashboard/billing?checkout=success',
    description:
      'URL a la que la landing devuelve al cliente tras pagar (o si abandona). Debe incluir protocolo http(s). ' +
      'La fija el SaaS por este canal autenticado — no un query param — para evitar open-redirect.',
  })
  // require_tld:false para permitir http://localhost en dev; los esquemas peligrosos
  // (javascript:, data:) siguen bloqueados porque protocols está restringido a http/https.
  @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] })
  @IsOptional()
  returnUrl?: string;
}
