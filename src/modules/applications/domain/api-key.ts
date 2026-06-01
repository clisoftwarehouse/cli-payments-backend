import { ApiProperty } from '@nestjs/swagger';

export class ApiKey {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty({ example: 'pk_live_abc123', description: 'Identificador público de la API key (visible).' })
  publicId: string;

  @ApiProperty({ example: 'Production key', description: 'Etiqueta humano-legible.' })
  label: string;

  @ApiProperty({ type: [String], example: ['payments:create', 'subscriptions:write', 'fx:read'] })
  scopes: string[];

  @ApiProperty({ required: false, nullable: true })
  lastUsedAt: Date | null;

  @ApiProperty({ required: false, nullable: true })
  revokedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ApiKeyWithSecret extends ApiKey {
  @ApiProperty({
    example: 'sk_live_b3a1f9c5...',
    description: 'Secreto plano — se muestra UNA SOLA VEZ al crear la key. Después se guarda solo el hash.',
  })
  secret: string;
}
