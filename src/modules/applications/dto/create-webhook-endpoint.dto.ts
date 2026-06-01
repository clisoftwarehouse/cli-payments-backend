import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsArray, IsString } from 'class-validator';

export class CreateWebhookEndpointDto {
  @ApiProperty({ example: 'https://vitriona.app/api/webhooks/cli-payments' })
  @IsUrl({ require_tld: false, require_protocol: true })
  url: string;

  @ApiProperty({
    type: [String],
    example: ['payment.succeeded', 'payment.failed', 'invoice.paid', 'subscription.renewed'],
  })
  @IsArray()
  @IsString({ each: true })
  activeEvents: string[];
}
