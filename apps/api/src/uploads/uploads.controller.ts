import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PRODUCT_IMAGE_MAX_BYTES, UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('product-image')
  @RequirePermissions('products.create')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES },
    }),
  )
  productImage(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: UploadedProductImage,
  ) {
    return this.uploads.productImage(user, file);
  }
}

export interface UploadedProductImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}
