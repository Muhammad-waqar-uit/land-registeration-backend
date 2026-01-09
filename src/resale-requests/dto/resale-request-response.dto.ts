import { ApiProperty } from '@nestjs/swagger';
import {
  ResaleRequest,
  ResaleRequestStatus,
} from '../../entities/resale-request.entity';

export class ResaleRequestResponseDto {
  @ApiProperty({ description: 'Resale Request ID' })
  id: string;

  @ApiProperty({ description: 'Property ID' })
  propertyId: string;

  @ApiProperty({ description: 'Current Owner ID (seller)' })
  currentOwnerId: string;

  @ApiProperty({ description: 'Builder ID (original builder)' })
  builderId: string;

  @ApiProperty({ description: 'Requested resale price' })
  requestedPrice: number;

  @ApiProperty({ enum: ResaleRequestStatus, description: 'Request status' })
  status: ResaleRequestStatus;

  @ApiProperty({
    description: 'Approval timestamp',
    required: false,
    nullable: true,
  })
  approvedAt: Date | null;

  @ApiProperty({
    description: 'Listing timestamp',
    required: false,
    nullable: true,
  })
  listedAt: Date | null;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  static fromEntity(request: ResaleRequest): ResaleRequestResponseDto {
    return {
      id: request.id,
      propertyId: request.propertyId,
      currentOwnerId: request.currentOwnerId,
      builderId: request.builderId,
      requestedPrice: request.requestedPrice,
      status: request.status,
      approvedAt: request.approvedAt,
      listedAt: request.listedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }
}
