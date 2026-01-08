import { ApiProperty } from '@nestjs/swagger';
import { Agreement, AgreementType, AgreementStatus } from '../../entities/agreement.entity';

export class AgreementResponseDto {
  @ApiProperty({ description: 'Agreement ID' })
  id: string;

  @ApiProperty({ description: 'Property ID' })
  propertyId: string;

  @ApiProperty({ description: 'Buyer ID' })
  buyerId: string;

  @ApiProperty({ description: 'Builder ID' })
  builderId: string;

  @ApiProperty({ enum: AgreementType, description: 'Agreement type' })
  agreementType: AgreementType;

  @ApiProperty({ enum: AgreementStatus, description: 'Agreement status' })
  status: AgreementStatus;

  @ApiProperty({ description: 'Document URL', required: false, nullable: true })
  documentUrl: string | null;

  @ApiProperty({ description: 'IPFS hash of document', required: false, nullable: true })
  documentIPFSHash: string | null;

  @ApiProperty({ description: 'SHA-256 hash of document', required: false, nullable: true })
  documentHash: string | null;

  @ApiProperty({ description: 'Buyer signed at', required: false, nullable: true })
  buyerSignedAt: Date | null;

  @ApiProperty({ description: 'Builder signed at', required: false, nullable: true })
  builderSignedAt: Date | null;

  @ApiProperty({ description: 'Signed document URL', required: false, nullable: true })
  signedDocumentUrl: string | null;

  @ApiProperty({ description: 'IPFS hash of signed document', required: false, nullable: true })
  signedDocumentIPFSHash: string | null;

  @ApiProperty({ description: 'SHA-256 hash of signed document', required: false, nullable: true })
  signedDocumentHash: string | null;

  @ApiProperty({ description: 'Blockchain transaction hash', required: false, nullable: true })
  blockchainTxHash: string | null;

  @ApiProperty({ description: 'Agreement terms (JSON)', required: false, nullable: true })
  terms: Record<string, any> | null;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  static fromEntity(agreement: Agreement): AgreementResponseDto {
    return {
      id: agreement.id,
      propertyId: agreement.propertyId,
      buyerId: agreement.buyerId,
      builderId: agreement.builderId,
      agreementType: agreement.agreementType,
      status: agreement.status,
      documentUrl: agreement.documentUrl,
      documentIPFSHash: agreement.documentIPFSHash,
      documentHash: agreement.documentHash,
      buyerSignedAt: agreement.buyerSignedAt,
      builderSignedAt: agreement.builderSignedAt,
      signedDocumentUrl: agreement.signedDocumentCID
        ? `/uploads/${agreement.signedDocumentCID}`
        : null,
      signedDocumentIPFSHash: agreement.signedDocumentIPFSHash,
      signedDocumentHash: agreement.signedDocumentHash,
      blockchainTxHash: agreement.blockchainTxHash,
      terms: agreement.terms,
      createdAt: agreement.createdAt,
      updatedAt: agreement.updatedAt,
    };
  }
}

