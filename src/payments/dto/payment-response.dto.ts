import { ApiProperty } from '@nestjs/swagger';
import { Payment, PaymentStatus, PaymentMode } from '../../entities/payment.entity';
import { Land } from '../../entities/land.entity';
import { User } from '../../entities/user.entity';

class LandInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  location: string;
}

class BuyerInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({
    description: 'Wallet address (Ethereum-compatible)',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    nullable: true,
  })
  walletAddress: string | null;
}

export class PaymentResponseDto {
  @ApiProperty({ description: 'Payment ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Land ID', example: 'uuid' })
  landId: string;

  @ApiProperty({ description: 'Buyer ID', example: 'uuid' })
  buyerId: string;

  @ApiProperty({ description: 'Payment amount', example: 50000.0 })
  amount: number;

  @ApiProperty({ description: 'Payment due date', example: '2024-02-01' })
  dueDate: Date;

  @ApiProperty({ description: 'Payment status', enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ description: 'Payment mode', enum: PaymentMode })
  paymentMode: PaymentMode;

  @ApiProperty({ description: 'Proof CID (IPFS)', required: false })
  proofCID?: string;

  @ApiProperty({ description: 'Transaction hash (for crypto)', required: false })
  transactionHash?: string;

  @ApiProperty({ description: 'Remarks/notes', required: false })
  remarks?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Land information', type: LandInfoDto, required: false })
  land?: LandInfoDto;

  @ApiProperty({ description: 'Buyer information', type: BuyerInfoDto, required: false })
  buyer?: BuyerInfoDto;

  static fromEntity(
    payment: Payment,
    includeRelations = false,
  ): PaymentResponseDto {
    const response: PaymentResponseDto = {
      id: payment.id,
      landId: payment.landId,
      buyerId: payment.buyerId,
      amount: parseFloat(payment.amount.toString()),
      dueDate: payment.dueDate,
      status: payment.status,
      paymentMode: payment.paymentMode,
      proofCID: payment.proofCID,
      transactionHash: payment.transactionHash,
      remarks: payment.remarks ?? undefined,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };

    if (includeRelations) {
      if (payment.land) {
        response.land = {
          id: payment.land.id,
          title: payment.land.title,
          location: payment.land.location,
        };
      }

      if (payment.buyer) {
        response.buyer = {
          id: payment.buyer.id,
          name: payment.buyer.name,
          email: payment.buyer.email,
          walletAddress: payment.buyer.walletAddress,
        };
      }
    }

    return response;
  }
}
