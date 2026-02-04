import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TransferRequest,
  TransferRequestStatus,
} from '../../entities/transfer-request.entity';
import {
  TransferDocument,
  TransferDocumentType,
} from '../../entities/transfer-document.entity';

class TransferDocumentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: TransferDocumentType })
  documentType: TransferDocumentType;

  @ApiProperty()
  documentUrl: string;

  @ApiProperty()
  documentHash: string;

  @ApiPropertyOptional()
  ipfsHash?: string | null;

  @ApiProperty()
  uploadedBy: string;

  @ApiProperty()
  uploadedAt: Date;
}

class PropertyInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  unitId?: string | null;
}

class UserInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class TransferRequestResponseDto {
  @ApiProperty({
    description: 'Transfer request ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Resale request ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  resaleRequestId: string;

  @ApiProperty({
    description: 'Property ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  propertyId: string;

  @ApiProperty({
    description: 'Current owner (seller) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  currentOwnerId: string;

  @ApiProperty({
    description: 'New owner (buyer) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  newOwnerId: string;

  @ApiProperty({
    description: 'Transfer request status',
    enum: TransferRequestStatus,
  })
  status: TransferRequestStatus;

  @ApiPropertyOptional({
    description: "Seller's notes",
  })
  notes?: string | null;

  @ApiPropertyOptional({
    description: "Builder's notes",
  })
  builderNotes?: string | null;

  @ApiProperty({
    description: 'When seller signed the transfer request',
  })
  signedAt: Date;

  @ApiPropertyOptional({
    description: 'When builder uploaded documents',
  })
  uploadedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'When transfer was completed',
  })
  completedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Property information',
    type: PropertyInfoDto,
  })
  property?: PropertyInfoDto;

  @ApiPropertyOptional({
    description: 'Current owner information',
    type: UserInfoDto,
  })
  currentOwner?: UserInfoDto;

  @ApiPropertyOptional({
    description: 'New owner information',
    type: UserInfoDto,
  })
  newOwner?: UserInfoDto;

  @ApiPropertyOptional({
    description: 'Transfer documents',
    type: [TransferDocumentDto],
  })
  documents?: TransferDocumentDto[];

  static fromEntity(
    transferRequest: TransferRequest,
    includeRelations = false,
  ): TransferRequestResponseDto {
    const response: TransferRequestResponseDto = {
      id: transferRequest.id,
      resaleRequestId: transferRequest.resaleRequestId,
      propertyId: transferRequest.propertyId,
      currentOwnerId: transferRequest.currentOwnerId,
      newOwnerId: transferRequest.newOwnerId,
      status: transferRequest.status,
      notes: transferRequest.notes,
      builderNotes: transferRequest.builderNotes,
      signedAt: transferRequest.signedAt,
      uploadedAt: transferRequest.uploadedAt,
      completedAt: transferRequest.completedAt,
      createdAt: transferRequest.createdAt,
      updatedAt: transferRequest.updatedAt,
    };

    if (includeRelations) {
      if (transferRequest.property) {
        response.property = {
          id: transferRequest.property.id,
          title: transferRequest.property.title,
          unitId: transferRequest.property.unitId,
        };
      }

      if (transferRequest.currentOwner) {
        response.currentOwner = {
          id: transferRequest.currentOwner.id,
          name: transferRequest.currentOwner.name,
          email: transferRequest.currentOwner.email,
        };
      }

      if (transferRequest.newOwner) {
        response.newOwner = {
          id: transferRequest.newOwner.id,
          name: transferRequest.newOwner.name,
          email: transferRequest.newOwner.email,
        };
      }

      if (transferRequest.documents && transferRequest.documents.length > 0) {
        response.documents = transferRequest.documents.map((doc) => ({
          id: doc.id,
          documentType: doc.documentType,
          documentUrl: doc.documentUrl,
          documentHash: doc.documentHash,
          ipfsHash: doc.ipfsHash,
          uploadedBy: doc.uploadedBy,
          uploadedAt: doc.uploadedAt,
        }));
      }
    }

    return response;
  }
}
