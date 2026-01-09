import { ApiProperty } from '@nestjs/swagger';
import { PaymentResponseDto } from './payment-response.dto';
import { InstallmentStatus } from '../../entities/installment.entity';

class InstallmentSummaryItemDto {
  @ApiProperty({ description: 'Installment ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Installment amount', example: 50000.0 })
  amount: number;

  @ApiProperty({
    description: 'Payment window start date',
    example: '2024-01-01',
  })
  paymentWindowStart: Date;

  @ApiProperty({
    description: 'Payment window end date',
    example: '2024-12-31',
  })
  paymentWindowEnd: Date;

  @ApiProperty({
    description: 'Actual payment date (if paid)',
    example: '2024-06-15',
    required: false,
  })
  paymentDate?: Date | null;

  @ApiProperty({
    description: 'Installment status',
    enum: InstallmentStatus,
    example: InstallmentStatus.PENDING,
  })
  status: InstallmentStatus;
}

export class InstallmentSummaryResponseDto {
  @ApiProperty({
    description: 'Total amount paid so far',
    example: 100000.0,
  })
  totalPaid: number;

  @ApiProperty({
    description: 'Remaining balance to be paid',
    example: 150000.0,
  })
  remainingBalance: number;

  @ApiProperty({
    description: 'Total property amount',
    example: 250000.0,
  })
  totalAmount: number;

  @ApiProperty({
    description: 'List of payments made',
    type: [PaymentResponseDto],
  })
  payments: PaymentResponseDto[];

  @ApiProperty({
    description: 'List of installments',
    type: [InstallmentSummaryItemDto],
  })
  installments: InstallmentSummaryItemDto[];
}
