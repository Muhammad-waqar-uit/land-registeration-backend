import { ApiProperty } from '@nestjs/swagger';
import { Land, LandStatus, AgreementStatus } from '../../entities/land.entity';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';
import { UserResponseDto } from '../../auth/dto/auth-response.dto';

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

/** Project summary with builder details for property responses */
export class ProjectDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  location: string;

  @ApiProperty({ nullable: true })
  locationDetails: string | null;

  @ApiProperty({ enum: ['pending_approval', 'approved', 'active', 'completed'] })
  status: string;

  @ApiProperty()
  totalUnits: number;

  @ApiProperty()
  soldUnits: number;

  @ApiProperty()
  builderId: string;

  @ApiProperty({ description: 'Builder user details', type: UserResponseDto, required: false })
  builder?: UserResponseDto;
}

export class LandResponseDto {
  @ApiProperty({ description: 'Land ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Land title', example: 'Beachfront Property' })
  title: string;

  @ApiProperty({
    description: 'Land location',
    example: '123 Ocean Drive, Miami',
  })
  location: string;

  @ApiProperty({
    description:
      'Auto-generated unique unit ID within project (e.g., SV-1, ABC-2)',
    example: 'SV-1',
    required: false,
  })
  unitId: string | null;

  @ApiProperty({
    description: 'Project ID this property belongs to',
    example: 'uuid',
    required: false,
  })
  projectId?: string | null;

  @ApiProperty({ description: 'Land size in square meters', example: 500.5 })
  size: number;

  @ApiProperty({ description: 'Land price', example: 250000.0 })
  price: number;

  @ApiProperty({ description: 'Land status', enum: LandStatus })
  status: LandStatus;

  @ApiProperty({ description: 'Owner ID', example: 'uuid' })
  ownerId: string;

  @ApiProperty({ description: 'Whether property is resale', required: false, default: false })
  isResale?: boolean;

  @ApiProperty({ description: 'Agreement status', enum: AgreementStatus, required: false })
  agreementStatus?: AgreementStatus;

  @ApiProperty({
    description: 'ID of the completed agreement for this property (if any)',
    example: 'uuid',
    required: false,
    nullable: true,
  })
  agreementId?: string | null;

  @ApiProperty({ description: 'Original owner ID (for resale)', required: false })
  originalOwnerId?: string | null;

  @ApiProperty({ description: 'Current owner ID', required: false })
  currentOwnerId?: string | null;

  @ApiProperty({ description: 'Installment plan years (2, 3, or 5)', required: false })
  installmentPlanYears?: number | null;

  @ApiProperty({ description: 'Installment start date', required: false })
  installmentStartDate?: Date | null;

  @ApiProperty({ description: 'Installment end date', required: false })
  installmentEndDate?: Date | null;

  @ApiProperty({ description: 'Total amount paid', required: false })
  totalPaid?: number;

  @ApiProperty({ description: 'Remaining balance', required: false })
  remainingBalance?: number | null;

  @ApiProperty({
    description: 'Document CID (local storage path)',
    required: false,
  })
  documentCID?: string;

  @ApiProperty({
    description: 'Document URL (full URL for viewing)',
    required: false,
  })
  documentUrl?: string;

  @ApiProperty({
    description: 'Image CID (local storage path)',
    required: false,
  })
  imageCID?: string;

  @ApiProperty({
    description: 'Image URL (full URL for viewing)',
    required: false,
  })
  imageUrl?: string;

  @ApiProperty({
    description:
      'Document IPFS hash (JSON string with structure: {hash: string, gateway: string, timestamp: string})',
    required: false,
  })
  documentIPFSHash?: string;

  @ApiProperty({
    description:
      'Image IPFS hash (JSON string with structure: {hash: string, gateway: string, timestamp: string})',
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

  @ApiProperty({
    description: 'Blockchain land ID (from smart contract)',
    example: 1,
    required: false,
  })
  blockchainLandId?: number;

  @ApiProperty({
    description: 'Blockchain transaction hash when land was registered',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    required: false,
  })
  blockchainTxHash?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Owner information',
    type: OwnerDto,
    required: false,
  })
  owner?: OwnerDto;

  @ApiProperty({
    description: 'Full owner user details',
    type: UserResponseDto,
    required: false,
  })
  ownerDetails?: UserResponseDto;

  @ApiProperty({
    description: 'Current owner user details (for resale)',
    type: UserResponseDto,
    required: false,
    nullable: true,
  })
  currentOwner?: UserResponseDto | null;

  @ApiProperty({
    description: 'Original owner user details (for resale)',
    type: UserResponseDto,
    required: false,
    nullable: true,
  })
  originalOwner?: UserResponseDto | null;

  @ApiProperty({
    description: 'Project details including builder',
    type: ProjectDetailDto,
    required: false,
  })
  project?: ProjectDetailDto;

  static fromEntity(land: Land, includeOwner = false): LandResponseDto {
    const response: LandResponseDto = {
      id: land.id,
      title: land.title,
      location: land.location,
      unitId: land.unitId ?? null,
      projectId: land.projectId,
      size: parseFloat(land.size.toString()),
      price: parseFloat(land.price.toString()),
      status: land.status,
      ownerId: land.ownerId,
      isResale: land.isResale,
      agreementStatus: land.agreementStatus,
      originalOwnerId: land.originalOwnerId ?? undefined,
      currentOwnerId: land.currentOwnerId ?? undefined,
      installmentPlanYears: land.installmentPlanYears ?? undefined,
      installmentStartDate: land.installmentStartDate ?? undefined,
      installmentEndDate: land.installmentEndDate ?? undefined,
      totalPaid: land.totalPaid != null ? parseFloat(land.totalPaid.toString()) : undefined,
      remainingBalance: land.remainingBalance != null ? parseFloat(land.remainingBalance.toString()) : undefined,
      documentCID: land.documentCID ?? undefined,
      documentUrl: land.documentUrl ?? undefined,
      documentIPFSHash: land.documentIPFSHash ?? undefined,
      documentHash: land.documentHash ?? undefined,
      imageCID: land.imageCID ?? undefined,
      imageUrl: land.imageUrl ?? undefined,
      imageIPFSHash: land.imageIPFSHash ?? undefined,
      imageHash: land.imageHash ?? undefined,
      blockchainLandId: land.blockchainLandId ?? undefined,
      blockchainTxHash: land.blockchainTxHash ?? undefined,
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

  /**
   * Build full response with project, builder, owner, currentOwner, originalOwner, agreementId.
   * Use when land is loaded with relations: owner, project, project.builder, currentOwner, originalOwner.
   */
  static fromEntityWithDetails(
    land: Land & {
      owner?: User;
      project?: Project | null;
      currentOwner?: User | null;
      originalOwner?: User | null;
    },
    agreementId?: string | null,
  ): LandResponseDto {
    const response = LandResponseDto.fromEntity(land, !!land.owner);
    if (agreementId !== undefined) {
      response.agreementId = agreementId ?? null;
    }
    if (land.owner) {
      response.ownerDetails = UserResponseDto.fromEntity(land.owner);
    }
    if (land.currentOwner) {
      response.currentOwner = UserResponseDto.fromEntity(land.currentOwner);
    } else if (land.currentOwnerId) {
      response.currentOwner = null;
    }
    if (land.originalOwner) {
      response.originalOwner = UserResponseDto.fromEntity(land.originalOwner);
    } else if (land.originalOwnerId) {
      response.originalOwner = null;
    }
    if (land.project) {
      response.project = {
        id: land.project.id,
        name: land.project.name,
        description: land.project.description ?? null,
        location: land.project.location,
        locationDetails: land.project.locationDetails ?? null,
        status: land.project.status,
        totalUnits: land.project.totalUnits,
        soldUnits: land.project.soldUnits,
        builderId: land.project.builderId,
      };
      const projectWithBuilder = land.project as Project & { builder?: User };
      if (projectWithBuilder.builder) {
        response.project.builder = UserResponseDto.fromEntity(projectWithBuilder.builder);
      }
    }
    return response;
  }
}
