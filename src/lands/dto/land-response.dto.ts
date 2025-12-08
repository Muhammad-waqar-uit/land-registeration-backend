import { ApiProperty } from '@nestjs/swagger';
import { Land, LandStatus } from '../../entities/land.entity';
import { User } from '../../entities/user.entity';

class OwnerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class LandResponseDto {
  @ApiProperty({ description: 'Land ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Land title', example: 'Beachfront Property' })
  title: string;

  @ApiProperty({ description: 'Land location', example: '123 Ocean Drive, Miami' })
  location: string;

  @ApiProperty({ description: 'Land size in square meters', example: 500.5 })
  size: number;

  @ApiProperty({ description: 'Land price', example: 250000.0 })
  price: number;

  @ApiProperty({ description: 'Land status', enum: LandStatus })
  status: LandStatus;

  @ApiProperty({ description: 'Owner ID', example: 'uuid' })
  ownerId: string;

  @ApiProperty({ description: 'Document hash', required: false })
  documentHash?: string;

  @ApiProperty({ description: 'Document CID (IPFS)', required: false })
  documentCID?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Owner information', type: OwnerDto, required: false })
  owner?: OwnerDto;

  static fromEntity(land: Land, includeOwner = false): LandResponseDto {
    const response: LandResponseDto = {
      id: land.id,
      title: land.title,
      location: land.location,
      size: parseFloat(land.size.toString()),
      price: parseFloat(land.price.toString()),
      status: land.status,
      ownerId: land.ownerId,
      documentHash: land.documentHash,
      documentCID: land.documentCID,
      createdAt: land.createdAt,
      updatedAt: land.updatedAt,
    };

    if (includeOwner && land.owner) {
      response.owner = {
        id: land.owner.id,
        name: land.owner.name,
        email: land.owner.email,
      };
    }

    return response;
  }
}
