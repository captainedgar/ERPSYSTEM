import { CategoryType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

import { CatalogQueryDto } from '../../catalog/dto/catalog-query.dto';

export class CategoryQueryDto extends CatalogQueryDto {
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;
}
