import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMode } from '../../entities/payment.entity';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Land/Property ID', example: 'uuid' })
  @IsUUID()
  landId: string;

  @ApiProperty({
    description: 'Agreement ID (required for agreement-based payments)',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  agreementId?: string;

  @ApiProperty({
    description: 'Installment ID (if payment is for a specific installment)',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  installmentId?: string;

  @ApiProperty({ description: 'Payment amount', example: 50000.0, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Payment due date (optional for timeline-based payments)',
    example: '2024-02-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ description: 'Payment mode', enum: PaymentMode, example: PaymentMode.BANK })
  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @ApiProperty({ description: 'Transaction hash (for crypto payments)', required: false })
  @IsOptional()
  @IsString()
  transactionHash?: string;
}
