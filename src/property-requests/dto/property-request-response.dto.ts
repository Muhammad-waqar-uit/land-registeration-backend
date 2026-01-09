import { ApiProperty } from '@nestjs/swagger';
import {
  PropertyRequest,
  PropertyRequestStatus,
} from '../../entities/property-request.entity';

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

  static fromEntity(request: PropertyRequest): PropertyRequestResponseDto {
    return {
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
  }
}
