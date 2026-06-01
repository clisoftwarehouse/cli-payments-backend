import { ApiProperty } from '@nestjs/swagger';

export class WebhookEndpoint {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty({ example: 'https://vitriona.app/api/webhooks/cli-payments' })
  url: string;

  @ApiProperty({
    type: [String],
    example: ['payment.succeeded', 'payment.failed', 'invoice.paid', 'subscription.renewed'],
  })
  activeEvents: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class WebhookEndpointWithSecret extends WebhookEndpoint {
  @ApiProperty({
    description: 'Secreto HMAC para validar las firmas X-CLIP-Signature en el lado del consumidor.',
  })
  signingSecret: string;
}
