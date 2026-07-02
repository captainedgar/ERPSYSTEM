import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @Matches(/^[A-Z0-9_-]+$/)
  @MaxLength(12)
  code!: string;

  @IsOptional()
  @IsBoolean()
  allowsDecimals?: boolean;
}
