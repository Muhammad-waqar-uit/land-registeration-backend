import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    OwnershipDocument,
    OwnershipDocumentStatus,
    OwnershipDocumentType,
} from '../entities/ownership-document.entity';
import { OwnershipDocumentFile } from '../entities/ownership-document-file.entity';
import { Land, LandStatus, AgreementStatus } from '../entities/land.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreateOwnershipDocumentDto } from './dto/create-ownership-document.dto';
import {
    AdminReviewDto,
    AdminReviewAction,
} from './dto/admin-review.dto';
import { OwnershipDocumentResponseDto } from './dto/ownership-document-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';
import { HashService } from '../common/services/hash.service';
import { IpfsService } from '../common/services/ipfs.service';
import { BlockchainService } from '../common/services/blockchain.service';

@Injectable()
export class OwnershipDocumentsService {
    constructor(
        @InjectRepository(OwnershipDocument)
        private ownershipDocRepository: Repository<OwnershipDocument>,
        @InjectRepository(OwnershipDocumentFile)
        private ownershipDocFileRepository: Repository<OwnershipDocumentFile>,
        @InjectRepository(Land)
        private landRepository: Repository<Land>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private fileStorageService: FileStorageService,
        private hashService: HashService,
        private ipfsService: IpfsService,
        private blockchainService: BlockchainService,
    ) { }

    /**
     * Builder or Admin uploads ownership documents for a property after payment completion
     */
    async uploadOwnershipDocuments(
        landId: string,
        userId: string,
        createDto: CreateOwnershipDocumentDto,
        files: Express.Multer.File[],
        userRole?: UserRole,
    ): Promise<OwnershipDocumentResponseDto> {
        // Verify property exists
        const property = await this.landRepository.findOne({
            where: { id: landId },
        });

        if (!property) {
            throw new NotFoundException('Property not found');
        }

        const originalBuilderId = property.originalOwnerId || property.ownerId;

        // Admin can upload on behalf; Builder must be verified and must be the original builder
        if (userRole === UserRole.ADMIN) {
            if (!originalBuilderId) {
                throw new BadRequestException(
                    'Property has no owner/builder. Cannot upload ownership documents.',
                );
            }
        } else {
            const builder = await this.userRepository.findOne({
                where: { id: userId },
            });

            if (!builder || !builder.isBuilderVerified) {
                throw new ForbiddenException('Only verified builders can upload ownership documents');
            }

            if (originalBuilderId !== userId) {
                throw new ForbiddenException('Only the original builder can upload ownership documents');
            }
        }

        // Use original builder as uploader when Admin uploads on behalf; otherwise the logged-in builder
        const uploaderId = userRole === UserRole.ADMIN ? originalBuilderId : userId;

        // Verify payment is completed
        if (property.agreementStatus !== AgreementStatus.COMPLETED) {
            throw new BadRequestException('Cannot upload ownership documents. Payment not completed yet.');
        }

        // Verify buyer exists
        const buyer = await this.userRepository.findOne({
            where: { id: createDto.buyerId },
        });

        if (!buyer) {
            throw new NotFoundException('Buyer not found');
        }

        // Check if ownership document already exists for this property and buyer
        const existingDoc = await this.ownershipDocRepository.findOne({
            where: {
                landId: landId,
                buyerId: createDto.buyerId,
                status: OwnershipDocumentStatus.PENDING_ADMIN_APPROVAL,
            },
        });

        if (existingDoc) {
            throw new BadRequestException(
                'Ownership documents already uploaded and pending admin approval',
            );
        }

        // Validate files
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded');
        }

        // Create ownership document entity
        const ownershipDoc = this.ownershipDocRepository.create({
            landId: landId,
            uploaderId: uploaderId,
            buyerId: createDto.buyerId,
            documentType: OwnershipDocumentType.INITIAL_OWNERSHIP,
            status: OwnershipDocumentStatus.PENDING_ADMIN_APPROVAL,
            notes: createDto.notes || null,
            uploadedAt: new Date(),
        });

        const savedDoc = await this.ownershipDocRepository.save(ownershipDoc);

        // Process each file
        const uploadedFiles: OwnershipDocumentFile[] = [];

        for (const file of files) {
            // Save file to storage
            const savedFile = await this.fileStorageService.uploadFile(
                'ownership-docs',
                file,
            );

            // Calculate hash
            const fileHash = this.hashService.calculateSHA256(file.buffer);

            // Optional: Upload to IPFS
            let ipfsHash: string | null = null;
            try {
                const ipfsResult = await this.ipfsService.uploadFile(file);
                if (ipfsResult && ipfsResult.hash) {
                    ipfsHash = JSON.stringify({
                        hash: ipfsResult.hash,
                        gateway: ipfsResult.gateway,
                        timestamp: ipfsResult.timestamp,
                    });
                }
            } catch (error) {
                console.error('IPFS upload failed:', error);
                // Continue without IPFS
            }

            // Create file entity
            const docFile = this.ownershipDocFileRepository.create({
                ownershipDocumentId: savedDoc.id,
                fileName: file.originalname,
                filePath: savedFile.path,
                fileUrl: savedFile.url,
                fileHash: fileHash,
                ipfsHash: ipfsHash,
                fileSize: file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date(),
            });

            const savedFileEntity =
                await this.ownershipDocFileRepository.save(docFile);
            uploadedFiles.push(savedFileEntity);
        }

        // Load with relations
        const docWithRelations = await this.ownershipDocRepository.findOne({
            where: { id: savedDoc.id },
            relations: ['property', 'uploader', 'buyer', 'documents'],
        });

        // TODO: Send notification to admin for review

        return OwnershipDocumentResponseDto.fromEntity(docWithRelations!, true);
    }

    /**
     * Admin reviews and approves/rejects ownership documents
     */
    async adminReview(
        ownershipDocId: string,
        adminId: string,
        reviewDto: AdminReviewDto,
    ): Promise<OwnershipDocumentResponseDto> {
        const ownershipDoc = await this.ownershipDocRepository.findOne({
            where: { id: ownershipDocId },
            relations: ['property', 'uploader', 'buyer', 'documents'],
        });

        if (!ownershipDoc) {
            throw new NotFoundException('Ownership document not found');
        }

        // Verify admin role
        const admin = await this.userRepository.findOne({
            where: { id: adminId },
        });

        if (!admin || admin.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only admins can review ownership documents');
        }

        // Verify status
        if (ownershipDoc.status !== OwnershipDocumentStatus.PENDING_ADMIN_APPROVAL) {
            throw new BadRequestException(
                `Cannot review ownership document with status "${ownershipDoc.status}"`,
            );
        }

        // Validate rejection reason
        if (
            reviewDto.action === AdminReviewAction.REJECT &&
            !reviewDto.rejectionReason
        ) {
            throw new BadRequestException('Rejection reason is required when rejecting');
        }

        const now = new Date();

        if (reviewDto.action === AdminReviewAction.APPROVE) {
            // Approve the documents
            ownershipDoc.status = OwnershipDocumentStatus.APPROVED;
            ownershipDoc.reviewedBy = adminId;
            ownershipDoc.reviewedAt = now;
            ownershipDoc.adminNotes = reviewDto.adminNotes || null;

            await this.ownershipDocRepository.save(ownershipDoc);

            // Transfer property ownership
            const property = ownershipDoc.property;
            property.ownerId = ownershipDoc.buyerId;
            property.currentOwnerId = ownershipDoc.buyerId;

            // Preserve original owner for resale tracking
            if (!property.originalOwnerId) {
                property.originalOwnerId = ownershipDoc.uploaderId;
            }

            property.status = LandStatus.OWNED;

            await this.landRepository.save(property);

            // Update ledger (LandLedgerLite) so on-chain owner matches DB
            const buyer = ownershipDoc.buyer;
            const builderOrSellerWallet = ownershipDoc.uploader?.walletAddress; // builder/seller for ledger register-if-missing
            if (
                this.blockchainService.isLedgerAvailable() &&
                buyer?.walletAddress
            ) {
                try {
                    const result =
                        await this.blockchainService.ledgerUpdatePropertyOwner(
                            property.id,
                            buyer.walletAddress,
                            false,
                            builderOrSellerWallet,
                        );
                    if (result.success) {
                        console.log(
                            `Ledger: property owner updated for land ${property.id} to buyer. TX: ${result.transactionHash}`,
                        );
                    } else {
                        console.warn(
                            `Ledger: failed to update property owner for land ${property.id}: ${result.error}`,
                        );
                    }
                } catch (error) {
                    console.error(
                        'Ledger: error updating property owner on ownership doc approve:',
                        error,
                    );
                }
            }

            // TODO: Send notification to builder and buyer

        } else if (reviewDto.action === AdminReviewAction.REJECT) {
            // Reject the documents
            ownershipDoc.status = OwnershipDocumentStatus.REJECTED;
            ownershipDoc.reviewedBy = adminId;
            ownershipDoc.reviewedAt = now;
            ownershipDoc.adminNotes = reviewDto.adminNotes || null;
            ownershipDoc.rejectionReason = reviewDto.rejectionReason || null;

            await this.ownershipDocRepository.save(ownershipDoc);

            // TODO: Send notification to builder with rejection reason
        }

        // Reload with updated relations
        const updatedDoc = await this.ownershipDocRepository.findOne({
            where: { id: ownershipDocId },
            relations: ['property', 'uploader', 'buyer', 'reviewer', 'documents'],
        });

        return OwnershipDocumentResponseDto.fromEntity(updatedDoc!, true);
    }

    /**
     * Get pending ownership documents for admin review
     */
    async getPendingForAdmin(): Promise<OwnershipDocumentResponseDto[]> {
        const pendingDocs = await this.ownershipDocRepository.find({
            where: { status: OwnershipDocumentStatus.PENDING_ADMIN_APPROVAL },
            relations: ['property', 'uploader', 'buyer', 'documents'],
            order: { createdAt: 'DESC' },
        });

        return pendingDocs.map((doc) =>
            OwnershipDocumentResponseDto.fromEntity(doc, true),
        );
    }

    /**
     * Get ownership document by ID
     */
    async findOne(id: string): Promise<OwnershipDocumentResponseDto> {
        const doc = await this.ownershipDocRepository.findOne({
            where: { id },
            relations: ['property', 'uploader', 'buyer', 'reviewer', 'documents'],
        });

        if (!doc) {
            throw new NotFoundException('Ownership document not found');
        }

        return OwnershipDocumentResponseDto.fromEntity(doc, true);
    }

    /**
     * Get ownership documents for a property
     */
    async findByProperty(landId: string): Promise<OwnershipDocumentResponseDto[]> {
        const docs = await this.ownershipDocRepository.find({
            where: { landId },
            relations: ['property', 'uploader', 'buyer', 'reviewer', 'documents'],
            order: { createdAt: 'DESC' },
        });

        return docs.map((doc) => OwnershipDocumentResponseDto.fromEntity(doc, true));
    }

    /**
     * Get ownership documents uploaded by a builder
     */
    async findByBuilder(builderId: string): Promise<OwnershipDocumentResponseDto[]> {
        const docs = await this.ownershipDocRepository.find({
            where: { uploaderId: builderId },
            relations: ['property', 'uploader', 'buyer', 'reviewer', 'documents'],
            order: { createdAt: 'DESC' },
        });

        return docs.map((doc) => OwnershipDocumentResponseDto.fromEntity(doc, true));
    }
}
