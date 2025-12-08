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
  @ApiProperty({ description: 'Land ID', example: 'uuid' })
  @IsUUID()
  landId: string;

  @ApiProperty({ description: 'Payment amount', example: 50000.0, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Payment due date', example: '2024-02-01' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ description: 'Payment mode', enum: PaymentMode, example: PaymentMode.BANK })
  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @ApiProperty({ description: 'Transaction hash (for crypto payments)', required: false })
  @IsOptional()
  @IsString()
  transactionHash?: string;
}
