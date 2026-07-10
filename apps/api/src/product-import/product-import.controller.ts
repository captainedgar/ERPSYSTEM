import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ProductImportOptionsDto } from './dto/product-import-options.dto';
import { ProductImportService } from './product-import.service';
import type { UploadedExcelFile } from './product-import.types';

const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;

const excelUpload = FileInterceptor('file', {
  limits: { fileSize: MAX_IMPORT_SIZE_BYTES },
  fileFilter: (_request, file, callback) => {
    const hasXlsxExtension = file.originalname.toLowerCase().endsWith('.xlsx');
    const isXlsxMime =
      file.mimetype ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!hasXlsxExtension || !isXlsxMime) {
      callback(
        new BadRequestException('Solo se permiten archivos .xlsx'),
        false,
      );
      return;
    }
    callback(null, true);
  },
});

@Controller('products/import')
export class ProductImportController {
  constructor(private readonly service: ProductImportService) {}

  @Get('template')
  @RequirePermissions('products.import')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="plantilla-productos-comercia.xlsx"',
  )
  async template(@Res() response: Response) {
    const buffer = await this.service.template();
    response.send(buffer);
  }

  @Post('preview')
  @RequirePermissions('products.import')
  @UseInterceptors(excelUpload)
  preview(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedExcelFile | undefined,
    @Query() options: ProductImportOptionsDto,
  ) {
    return this.service.preview(user, this.requiredFile(file), options);
  }

  @Post('commit')
  @RequirePermissions('products.import')
  @UseInterceptors(excelUpload)
  commit(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedExcelFile | undefined,
    @Query() options: ProductImportOptionsDto,
  ) {
    return this.service.commit(user, this.requiredFile(file), options);
  }

  private requiredFile(file: UploadedExcelFile | undefined) {
    if (!file) {
      throw new BadRequestException('Debes subir un archivo .xlsx');
    }
    return file;
  }
}
