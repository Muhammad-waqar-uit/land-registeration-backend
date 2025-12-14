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
  @Roles(UserRole.BUYER)
  @UseInterceptors(FileInterceptor('proof'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a payment record' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        landId: { type: 'string', format: 'uuid', example: 'uuid' },
        amount: { type: 'number', example: 50000.0 },
        dueDate: { type: 'string', format: 'date', example: '2024-02-01' },
        paymentMode: { type: 'string', enum: ['bank', 'crypto'], example: 'bank' },
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
  @ApiResponse({ status: 403, description: 'Forbidden - Buyer only' })
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.create(createPaymentDto, file, user.id);
  }

  @Get('my-payments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUYER)
  @ApiOperation({ summary: 'Get payments for current buyer' })
  @ApiResponse({
    status: 200,
    description: 'List of payments',
    type: [PaymentResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Buyer only' })
  findMyPayments(@CurrentUser() user: User) {
    return this.paymentsService.findMyPayments(user.id);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Get pending payments for seller\'s lands (for verification)' })
  @ApiResponse({
    status: 200,
    description: 'List of pending payments for seller\'s lands',
    type: [PaymentResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Seller only' })
  findPendingPayments(@CurrentUser() user: User) {
    return this.paymentsService.findPendingPaymentsForSeller(user.id);
  }

  @Post(':id/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Verify or reject a payment (Seller only - for own lands)' })
  @ApiResponse({
    status: 200,
    description: 'Payment verification result',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Seller only, or payment not for your land' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() verifyPaymentDto: VerifyPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.verify(id, verifyPaymentDto, user.id);
  }
}
