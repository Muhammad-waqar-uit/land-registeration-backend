import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ResaleRequest,
  ResaleRequestStatus,
} from '../../entities/resale-request.entity';
import { LandStatus } from '../../entities/land.entity';

class PropertyInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  location: string;

  @ApiPropertyOptional()
  unitId?: string | null;

  @ApiPropertyOptional()
  projectId?: string | null;

  @ApiProperty()
  size: number;

  @ApiProperty()
  price: number;

  @ApiProperty({ enum: LandStatus })
  status: LandStatus;

  @ApiProperty()
  isResale: boolean;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  totalPaid?: number;
}

class UserInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phoneNumber?: string | null;

  @ApiPropertyOptional()
  companyName?: string | null;
}

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

  @ApiPropertyOptional({
    description: 'Property details',
    type: PropertyInfoDto,
  })
  property?: PropertyInfoDto;

  @ApiPropertyOptional({
    description: 'Current owner (seller) details',
    type: UserInfoDto,
  })
  currentOwner?: UserInfoDto;

  @ApiPropertyOptional({
    description: 'Builder details',
    type: UserInfoDto,
  })
  builder?: UserInfoDto;

  static fromEntity(
    request: ResaleRequest,
    includeRelations = false,
  ): ResaleRequestResponseDto {
    const response: ResaleRequestResponseDto = {
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

    if (includeRelations && request.property) {
      response.property = {
        id: request.property.id,
        title: request.property.title,
        location: request.property.location,
        unitId: request.property.unitId,
        projectId: request.property.projectId,
        size: Number(request.property.size),
        price: Number(request.property.price),
        status: request.property.status,
        isResale: request.property.isResale,
        imageUrl: request.property.imageUrl,
        totalPaid: request.property.totalPaid
          ? Number(request.property.totalPaid)
          : undefined,
      };
    }

    if (includeRelations && request.currentOwner) {
      response.currentOwner = {
        id: request.currentOwner.id,
        name: request.currentOwner.name,
        email: request.currentOwner.email,
        phoneNumber: request.currentOwner.phoneNumber,
        companyName: request.currentOwner.companyName,
      };
    }

    if (includeRelations && request.builder) {
      response.builder = {
        id: request.builder.id,
        name: request.builder.name,
        email: request.builder.email,
        phoneNumber: request.builder.phoneNumber,
        companyName: request.builder.companyName,
      };
    }

    return response;
  }
}
