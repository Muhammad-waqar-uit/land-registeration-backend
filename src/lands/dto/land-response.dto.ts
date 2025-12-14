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

  @ApiProperty({
    description: 'Wallet address (Ethereum-compatible)',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    nullable: true,
  })
  walletAddress: string | null;
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

  @ApiProperty({ description: 'Document CID (local storage path)', required: false })
  documentCID?: string;

  @ApiProperty({ description: 'Document URL (full URL for viewing)', required: false })
  documentUrl?: string;

  @ApiProperty({ description: 'Image CID (local storage path)', required: false })
  imageCID?: string;

  @ApiProperty({ description: 'Image URL (full URL for viewing)', required: false })
  imageUrl?: string;

  @ApiProperty({
    description: 'Document IPFS hash (JSON string with structure: {hash: string, gateway: string, timestamp: string})',
    required: false,
  })
  documentIPFSHash?: string;

  @ApiProperty({
    description: 'Image IPFS hash (JSON string with structure: {hash: string, gateway: string, timestamp: string})',
    required: false,
  })
  imageIPFSHash?: string;

  @ApiProperty({
    description: 'Document SHA-256 hash for tamper detection',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
    required: false,
  })
  documentHash?: string;

  @ApiProperty({
    description: 'Image SHA-256 hash for tamper detection',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
    required: false,
  })
  imageHash?: string;

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
      documentCID: land.documentCID,
      documentUrl: land.documentUrl,
      documentIPFSHash: land.documentIPFSHash,
      documentHash: land.documentHash,
      imageCID: land.imageCID,
      imageUrl: land.imageUrl,
      imageIPFSHash: land.imageIPFSHash,
      imageHash: land.imageHash,
      createdAt: land.createdAt,
      updatedAt: land.updatedAt,
    };

    if (includeOwner && land.owner) {
      response.owner = {
        id: land.owner.id,
        name: land.owner.name,
        email: land.owner.email,
        walletAddress: land.owner.walletAddress,
      };
    }

    return response;
  }
}
