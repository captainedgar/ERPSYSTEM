import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PaymentGatewayService } from './payment-gateway.service';

@Controller('billing/webhooks')
export class PaymentWebhookController {
  constructor(private readonly gateway: PaymentGatewayService) {}
  @Public()
  @Post('paypal')
  paypal(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: Parameters<PaymentGatewayService['handleWebhook']>[1],
  ) {
    return this.gateway.handleWebhook(headers, payload);
  }
}
