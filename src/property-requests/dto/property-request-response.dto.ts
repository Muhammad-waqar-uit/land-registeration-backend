import { ApiProperty } from '@nestjs/swagger';
import {
  PropertyRequest,
  PropertyRequestStatus,
} from '../../entities/property-request.entity';
import { User } from '../../entities/user.entity';
import { Land } from '../../entities/land.entity';

class BuyerDto {
  @ApiProperty({ description: 'Buyer ID' })
  id: string;

  @ApiProperty({ description: 'Buyer name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'Buyer email', example: 'john@example.com' })
  email: string;

  @ApiProperty({
    description: 'Wallet address (Ethereum-compatible)',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    nullable: true,
  })
  walletAddress: string | null;
}

class PropertyDto {
  @ApiProperty({ description: 'Property ID' })
  id: string;

  @ApiProperty({
    description: 'Property title',
    example: 'Beachfront Property Unit A-101',
  })
  title: string;

  @ApiProperty({
    description: 'Property location',
    example: '123 Ocean Drive, Miami, FL',
  })
  location: string;

  @ApiProperty({ description: 'Property price', example: 250000.0 })
  price: number;

  @ApiProperty({ description: 'Property status' })
  status: string;

  @ApiProperty({
    description: 'Property size in square meters',
    example: 500.5,
  })
  size: number;
}

export class PropertyRequestResponseDto {
  @ApiProperty({ description: 'Property Request ID' })
  id: string;

  @ApiProperty({ description: 'Property ID' })
  propertyId: string;

  @ApiProperty({ description: 'Buyer ID' })
  buyerId: string;

  @ApiProperty({ enum: PropertyRequestStatus, description: 'Request status' })
  status: PropertyRequestStatus;

  @ApiProperty({
    description: "Buyer's requested price",
    required: false,
    nullable: true,
  })
  requestedPrice: number | null;

  @ApiProperty({
    description: "Builder's response message",
    required: false,
    nullable: true,
  })
  builderResponse: string | null;

  @ApiProperty({
    description: 'Response timestamp',
    required: false,
    nullable: true,
  })
  respondedAt: Date | null;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Buyer information',
    type: BuyerDto,
    required: false,
  })
  buyer?: BuyerDto;

  @ApiProperty({
    description: 'Property information',
    type: PropertyDto,
    required: false,
  })
  property?: PropertyDto;

  @ApiProperty({
    description: 'Agreement ID if agreement exists for this request',
    example: 'uuid',
    nullable: true,
    required: false,
  })
  agreementId?: string | null;

  static fromEntity(
    request: PropertyRequest & {
      buyer?: User;
      property?: Land;
      agreementId?: string | null;
    },
  ): PropertyRequestResponseDto {
    const dto: PropertyRequestResponseDto = {
      id: request.id,
      propertyId: request.propertyId,
      buyerId: request.buyerId,
      status: request.status,
      requestedPrice: request.requestedPrice,
      builderResponse: request.builderResponse,
      respondedAt: request.respondedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };

    // Include buyer information if loaded
    if (request.buyer) {
      dto.buyer = {
        id: request.buyer.id,
        name: request.buyer.name,
        email: request.buyer.email,
        walletAddress: request.buyer.walletAddress,
      };
    }

    // Include property information if loaded
    if (request.property) {
      dto.property = {
        id: request.property.id,
        title: request.property.title,
        location: request.property.location,
        price: request.property.price,
        status: request.property.status,
        size: request.property.size,
      };
    }

    // Include agreement ID if provided
    if (request.agreementId !== undefined) {
      dto.agreementId = request.agreementId;
    }

    return dto;
  }
}
