import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { InstallmentSummaryResponseDto } from './dto/installment-summary-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER, UserRole.BUILDER)
  @UseInterceptors(FileInterceptor('proof'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a payment record' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        landId: { type: 'string', format: 'uuid', example: 'uuid' },
        agreementId: { type: 'string', format: 'uuid', example: 'uuid' },
        installmentId: { type: 'string', format: 'uuid', example: 'uuid' },
        amount: { type: 'number', example: 50000.0 },
        dueDate: { type: 'string', format: 'date', example: '2024-02-01' },
        paymentMode: {
          type: 'string',
          enum: ['bank', 'crypto'],
          example: 'bank',
        },
        transactionHash: { type: 'string' },
        proof: {
          type: 'string',
          format: 'binary',
          description: 'Payment proof file (optional)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Payment successfully created',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - User only' })
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.create(createPaymentDto, file, user.id);
  }

  @Get('my-payments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Get payments for current user' })
  @ApiResponse({
    status: 200,
    description: 'List of payments',
    type: [PaymentResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden - User only' })
  findMyPayments(@CurrentUser() user: User) {
    return this.paymentsService.findMyPayments(user.id);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({
    summary: "Get pending payments for builder's properties (for verification)",
  })
  @ApiResponse({
    status: 200,
    description: "List of pending payments for builder's properties",
    type: [PaymentResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Builder only' })
  findPendingPayments(@CurrentUser() user: User) {
    return this.paymentsService.findPendingPaymentsForBuilder(user.id);
  }

  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get payments for property' })
  @ApiResponse({
    status: 200,
    description: 'List of payments for the property',
    type: [PaymentResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  getPropertyPayments(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.paymentsService.findPaymentsByProperty(propertyId);
  }

  @Get('agreement/:agreementId')
  @ApiOperation({ summary: 'Get payments for agreement' })
  @ApiResponse({
    status: 200,
    description: 'List of payments for the agreement',
    type: [PaymentResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  getAgreementPayments(
    @Param('agreementId', ParseUUIDPipe) agreementId: string,
  ) {
    return this.paymentsService.findPaymentsByAgreement(agreementId);
  }

  @Get('installment-summary/:propertyId')
  @ApiOperation({
    summary: 'Get payment summary (total paid, remaining, timeline)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment summary for the property',
    type: InstallmentSummaryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  getInstallmentSummary(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<InstallmentSummaryResponseDto> {
    return this.paymentsService.getInstallmentSummary(propertyId);
  }

  @Post(':id/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Verify or reject a payment (Builder/Admin only - for own properties)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verification result',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Builder/Admin only, or payment not for your property',
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() verifyPaymentDto: VerifyPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.verify(id, verifyPaymentDto, user.id);
  }
}
