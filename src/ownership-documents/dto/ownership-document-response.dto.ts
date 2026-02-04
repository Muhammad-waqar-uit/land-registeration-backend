import {
    OwnershipDocument,
    OwnershipDocumentStatus,
    OwnershipDocumentType,
} from '../../entities/ownership-document.entity';

export class OwnershipDocumentFileDto {
    id: string;
    fileName: string;
    fileUrl: string;
    fileHash: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: Date;
    ipfsHash?: string | null;
}

export class OwnershipDocumentResponseDto {
    id: string;
    landId: string;
    uploaderId: string;
    buyerId: string;
    documentType: OwnershipDocumentType;
    status: OwnershipDocumentStatus;
    notes: string | null;
    uploadedAt: Date;

    // Admin review fields
    reviewedBy?: string | null;
    reviewedAt?: Date | null;
    adminNotes?: string | null;
    rejectionReason?: string | null;

    // Include relations if requested
    property?: any;
    uploader?: any;
    buyer?: any;
    reviewer?: any;
    documents?: OwnershipDocumentFileDto[];

    createdAt: Date;
    updatedAt: Date;

    static fromEntity(
        entity: OwnershipDocument,
        includeRelations = false,
    ): OwnershipDocumentResponseDto {
        const dto = new OwnershipDocumentResponseDto();

        dto.id = entity.id;
        dto.landId = entity.landId;
        dto.uploaderId = entity.uploaderId;
        dto.buyerId = entity.buyerId;
        dto.documentType = entity.documentType;
        dto.status = entity.status;
        dto.notes = entity.notes;
        dto.uploadedAt = entity.uploadedAt;
        dto.reviewedBy = entity.reviewedBy;
        dto.reviewedAt = entity.reviewedAt;
        dto.adminNotes = entity.adminNotes;
        dto.rejectionReason = entity.rejectionReason;
        dto.createdAt = entity.createdAt;
        dto.updatedAt = entity.updatedAt;

        if (includeRelations) {
            if (entity.property) {
                dto.property = {
                    id: entity.property.id,
                    title: entity.property.title,
                    unitId: entity.property.unitId,
                    location: entity.property.location,
                    price: entity.property.price,
                    size: entity.property.size,
                    status: entity.property.status,
                };
            }

            if (entity.uploader) {
                dto.uploader = {
                    id: entity.uploader.id,
                    name: entity.uploader.name,
                    email: entity.uploader.email,
                    phone: entity.uploader.phoneNumber,
                    role: entity.uploader.role,
                    isBuilderVerified: entity.uploader.isBuilderVerified,
                };
            }

            if (entity.buyer) {
                dto.buyer = {
                    id: entity.buyer.id,
                    name: entity.buyer.name,
                    email: entity.buyer.email,
                    phone: entity.buyer.phoneNumber,
                    cnic: entity.buyer.cnic,
                };
            }

            if (entity.reviewer) {
                dto.reviewer = {
                    id: entity.reviewer.id,
                    name: entity.reviewer.name,
                    email: entity.reviewer.email,
                    role: entity.reviewer.role,
                };
            }

            if (entity.documents && entity.documents.length > 0) {
                dto.documents = entity.documents.map((doc) => ({
                    id: doc.id,
                    fileName: doc.fileName,
                    fileUrl: doc.fileUrl,
                    fileHash: doc.fileHash,
                    fileSize: doc.fileSize,
                    mimeType: doc.mimeType,
                    uploadedAt: doc.uploadedAt,
                    ipfsHash: doc.ipfsHash,
                }));
            }
        }

        return dto;
    }
}
