import { ApiProperty } from '@nestjs/swagger';
import { Installment, InstallmentStatus } from '../../entities/installment.entity';

export class InstallmentResponseDto {
  @ApiProperty({ description: 'Installment ID' })
  id: string;

  @ApiProperty({ description: 'Property/Land ID' })
  landId: string;

  @ApiProperty({ description: 'Agreement ID', required: false, nullable: true })
  agreementId: string | null;

  @ApiProperty({ description: 'Buyer ID' })
  buyerId: string;

  @ApiProperty({ description: 'Installment amount' })
  amount: number;

  @ApiProperty({ description: 'Payment window start date' })
  paymentWindowStart: Date;

  @ApiProperty({ description: 'Payment window end date' })
  paymentWindowEnd: Date;

  @ApiProperty({ enum: InstallmentStatus, description: 'Installment status' })
  status: InstallmentStatus;

  @ApiProperty({ description: 'Actual payment date', required: false, nullable: true })
  paymentDate: Date | null;

  @ApiProperty({ description: 'Installment plan ID', required: false, nullable: true })
  installmentPlanId: string | null;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  static fromEntity(installment: Installment): InstallmentResponseDto {
    return {
      id: installment.id,
      landId: installment.landId,
      agreementId: installment.agreementId,
      buyerId: installment.buyerId,
      amount: installment.amount,
      paymentWindowStart: installment.paymentWindowStart,
      paymentWindowEnd: installment.paymentWindowEnd,
      status: installment.status,
      paymentDate: installment.paymentDate,
      installmentPlanId: installment.installmentPlanId,
      createdAt: installment.createdAt,
      updatedAt: installment.updatedAt,
    };
  }
}

