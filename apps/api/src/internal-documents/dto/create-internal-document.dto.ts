import { InternalDocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInternalDocumentDto {
  @IsEnum(InternalDocumentType)
  documentType!: InternalDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
