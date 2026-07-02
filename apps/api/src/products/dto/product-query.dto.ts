import { IsOptional, IsString, MinLength } from 'class-validator';

import { CatalogQueryDto } from '../../catalog/dto/catalog-query.dto';

export class ProductQueryDto extends CatalogQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  brandId?: string;
}
