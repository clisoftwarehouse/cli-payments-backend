import { ApiProperty } from '@nestjs/swagger';

export type ApplicationMode = 'live' | 'test';

export class Application {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'vitriona', description: 'Identificador slug único: aparece en logs y dashboards.' })
  slug: string;

  @ApiProperty({ example: 'Vitriona' })
  name: string;

  @ApiProperty({ enum: ['live', 'test'] })
  mode: ApplicationMode;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true, description: 'URL pública del SaaS (para enlaces de retorno).' })
  websiteUrl: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Email de contacto técnico.' })
  contactEmail: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
