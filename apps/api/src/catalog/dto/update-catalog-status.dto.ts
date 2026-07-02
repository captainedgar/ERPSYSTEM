import { CatalogStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCatalogStatusDto {
  @IsEnum(CatalogStatus)
  status!: CatalogStatus;
}
