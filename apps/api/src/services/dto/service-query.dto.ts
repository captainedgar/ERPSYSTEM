import { IsOptional, IsString, MinLength } from 'class-validator';

import { CatalogQueryDto } from '../../catalog/dto/catalog-query.dto';

export class ServiceQueryDto extends CatalogQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  categoryId?: string;
}
