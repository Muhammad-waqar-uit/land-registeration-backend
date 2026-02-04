import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TransferRequest,
  TransferRequestStatus,
} from '../entities/transfer-request.entity';
import {
  TransferDocument,
  TransferDocumentType,
} from '../entities/transfer-document.entity';
import {
  ResaleRequest,
  ResaleRequestStatus,
} from '../entities/resale-request.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreateTransferRequestDto } from './dto/create-transfer-request.dto';
import { QueryTransferRequestsDto } from './dto/query-transfer-requests.dto';
import { TransferRequestResponseDto } from './dto/transfer-request-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';
import { HashService } from '../common/services/hash.service';
import { IpfsService } from '../common/services/ipfs.service';
import { ConfirmPaymentAndTransferDto } from './dto/confirm-payment-transfer.dto';
import {
  TransferAdminReviewDto,
  TransferAdminAction,
} from './dto/transfer-admin-review.dto';

@Injectable()
export class TransferRequestsService {
  constructor(
    @InjectRepository(TransferRequest)
    private transferRequestRepository: Repository<TransferRequest>,
    @InjectRepository(TransferDocument)
    private transferDocumentRepository: Repository<TransferDocument>,
    @InjectRepository(ResaleRequest)
    private resaleRequestRepository: Repository<ResaleRequest>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private fileStorageService: FileStorageService,
    private hashService: HashService,
    private ipfsService: IpfsService,
  ) { }

  /**
   * Seller confirms payment and allows document change (NEW - Enhanced Resale Flow)
   * This must be done BEFORE builder uploads documents
   */
  async confirmPaymentAndAllowTransfer(
    resaleRequestId: string,
    currentOwnerId: string,
    confirmDto: ConfirmPaymentAndTransferDto,
  ): Promise<TransferRequestResponseDto> {
    // Find resale request
    const resaleRequest = await this.resaleRequestRepository.findOne({
      where: { id: resaleRequestId },
      relations: ['property'],
    });

    if (!resaleRequest) {
      throw new NotFoundException('Resale request not found');
    }

    // Verify seller owns the property
    if (resaleRequest.currentOwnerId !== currentOwnerId) {
      throw new ForbiddenException(
        'You are not authorized to confirm payment for this property',
      );
    }

    // Verify resale request is LISTED
    if (resaleRequest.status !== ResaleRequestStatus.LISTED) {
      throw new BadRequestException(
        'Cannot confirm payment. Property must be listed for resale.',
      );
    }

    // Get property to verify payment completion
    const property = await this.landRepository.findOne({
      where: { id: resaleRequest.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // CRITICAL: Verify FULL payment completed (no half payment allowed)
    const remainingBalance = Number(property.price) - Number(property.totalPaid);
    if (remainingBalance > 0.01) {
      // Allow small floating point difference
      throw new BadRequestException(
        `Cannot proceed with transfer. Payment not complete. Remaining balance: ₹${remainingBalance.toFixed(2)}. Full payment is required for resale transfers.`,
      );
    }

    // Verify new owner exists
    const newOwner = await this.userRepository.findOne({
      where: { id: confirmDto.newOwnerId },
    });

    if (!newOwner) {
      throw new NotFoundException('New owner (buyer) not found');
    }

    // Check if transfer request already exists
    const existingTransfer = await this.transferRequestRepository.findOne({
      where: {
        resaleRequestId: resaleRequestId,
        currentOwnerId: currentOwnerId,
      },
    });

    if (existingTransfer) {
      throw new BadRequestException(
        'Transfer request already exists for this resale',
      );
    }

    // Create transfer request with payment confirmation
    const now = new Date();
    const transferRequest = this.transferRequestRepository.create({
      resaleRequestId: resaleRequestId,
      propertyId: resaleRequest.propertyId,
      currentOwnerId: currentOwnerId,
      newOwnerId: confirmDto.newOwnerId,
      notes: confirmDto.confirmationNotes || null,
      paymentConfirmed: confirmDto.paymentConfirmed,
      paymentConfirmedAt: confirmDto.paymentConfirmed ? now : null,
      documentChangeAllowed: confirmDto.allowDocumentChange,
      status: TransferRequestStatus.PENDING_BUILDER_DOCUMENTS,
      signedAt: now,
    });

    const savedRequest =
      await this.transferRequestRepository.save(transferRequest);

    // TODO: Send notification to builder to upload documents

    return TransferRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * Seller creates/signs transfer request
   */
  async createTransferRequest(
    resaleRequestId: string,
    currentOwnerId: string,
    createDto: CreateTransferRequestDto,
  ): Promise<TransferRequestResponseDto> {
    // Find resale request
    const resaleRequest = await this.resaleRequestRepository.findOne({
      where: { id: resaleRequestId },
      relations: ['property'],
    });

    if (!resaleRequest) {
      throw new NotFoundException('Resale request not found');
    }

    // Verify seller owns the property
    if (resaleRequest.currentOwnerId !== currentOwnerId) {
      throw new ForbiddenException(
        'You are not authorized to create transfer request for this property',
      );
    }

    // Verify resale request is LISTED (property must be listed)
    if (resaleRequest.status !== ResaleRequestStatus.LISTED) {
      throw new BadRequestException(
        `Cannot create transfer request for resale with status "${resaleRequest.status}". Property must be listed.`,
      );
    }

    // Check if transfer request already exists
    const existingTransfer = await this.transferRequestRepository.findOne({
      where: {
        resaleRequestId: resaleRequestId,
        currentOwnerId: currentOwnerId,
      },
    });

    if (existingTransfer) {
      throw new BadRequestException(
        'Transfer request already exists for this resale',
      );
    }

    // Verify new owner (buyer) exists
    const newOwner = await this.userRepository.findOne({
      where: { id: createDto.newOwnerId },
    });

    if (!newOwner) {
      throw new NotFoundException('New owner (buyer) not found');
    }

    // Create transfer request
    const transferRequest = this.transferRequestRepository.create({
      resaleRequestId: resaleRequestId,
      propertyId: resaleRequest.propertyId,
      currentOwnerId: currentOwnerId,
      newOwnerId: createDto.newOwnerId,
      notes: createDto.notes || null,
      status: TransferRequestStatus.PENDING_BUILDER_DOCUMENTS,
      signedAt: new Date(),
    });

    const savedRequest =
      await this.transferRequestRepository.save(transferRequest);

    return TransferRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * Builder uploads transfer documents
   */
  async uploadDocuments(
    transferRequestId: string,
    builderId: string,
    files: Express.Multer.File[],
    builderNotes?: string,
  ): Promise<TransferRequestResponseDto> {
    const transferRequest = await this.transferRequestRepository.findOne({
      where: { id: transferRequestId },
      relations: ['resaleRequest', 'property'],
    });

    if (!transferRequest) {
      throw new NotFoundException('Transfer request not found');
    }

    // Verify builder authorization (original builder of the property)
    const property = await this.landRepository.findOne({
      where: { id: transferRequest.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const originalBuilderId = property.originalOwnerId || property.ownerId;
    if (originalBuilderId !== builderId) {
      throw new ForbiddenException(
        'Only the original builder can upload transfer documents',
      );
    }

    // Verify status
    if (
      transferRequest.status !== TransferRequestStatus.PENDING_BUILDER_DOCUMENTS
    ) {
      throw new BadRequestException(
        `Cannot upload documents for transfer request with status "${transferRequest.status}"`,
      );
    }

    // Verify builder is verified
    const builder = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (!builder || !builder.isBuilderVerified) {
      throw new ForbiddenException(
        'Only verified builders can upload transfer documents',
      );
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Process each file
    const uploadedDocuments: TransferDocument[] = [];

    for (const file of files) {
      // Determine document type from filename or default to OTHER
      let documentType = TransferDocumentType.OTHER;
      const filename = file.originalname.toLowerCase();

      if (filename.includes('deed')) {
        documentType = TransferDocumentType.TRANSFER_DEED;
      } else if (filename.includes('noc')) {
        documentType = TransferDocumentType.NOC;
      } else if (filename.includes('ownership')) {
        documentType = TransferDocumentType.OWNERSHIP;
      }

      //  Save file to storage
      const savedFile = await this.fileStorageService.uploadFile(
        'transfer-docs',
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

      // Create transfer document
      const transferDoc = this.transferDocumentRepository.create({
        transferRequestId: transferRequestId,
        documentType: documentType,
        documentCID: savedFile.path,
        documentUrl: savedFile.url,
        documentHash: fileHash,
        ipfsHash: ipfsHash,
        uploadedBy: builderId,
        uploadedAt: new Date(),
      });

      const savedDoc = await this.transferDocumentRepository.save(transferDoc);
      uploadedDocuments.push(savedDoc);
    }

    // Update transfer request - Now goes to admin for review
    transferRequest.status = TransferRequestStatus.PENDING_ADMIN_APPROVAL;
    transferRequest.builderNotes = builderNotes || null;
    transferRequest.uploadedAt = new Date();

    const savedRequest =
      await this.transferRequestRepository.save(transferRequest);

    // TODO: Send notification to admin for review

    // Load with documents
    const requestWithDocs = await this.transferRequestRepository.findOne({
      where: { id: transferRequestId },
      relations: ['documents', 'property', 'currentOwner', 'newOwner'],
    });

    return TransferRequestResponseDto.fromEntity(requestWithDocs!, true);
  }

  /**
   * Builder/Admin completes ownership transfer
   */
  async completeTransfer(
    transferRequestId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<TransferRequestResponseDto> {
    const transferRequest = await this.transferRequestRepository.findOne({
      where: { id: transferRequestId },
      relations: ['resaleRequest', 'property', 'documents'],
    });

    if (!transferRequest) {
      throw new NotFoundException('Transfer request not found');
    }

    // Verify authorization (builder or admin)
    const property = await this.landRepository.findOne({
      where: { id: transferRequest.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const originalBuilderId = property.originalOwnerId || property.ownerId;
    if (userRole !== UserRole.ADMIN && originalBuilderId !== userId) {
      throw new ForbiddenException(
        'Only the original builder or admin can complete the transfer',
      );
    }

    // Verify status
    if (transferRequest.status !== TransferRequestStatus.DOCUMENTS_UPLOADED) {
      throw new BadRequestException(
        `Cannot complete transfer with status "${transferRequest.status}". Documents must be uploaded first.`,
      );
    }

    // Update property ownership
    property.ownerId = transferRequest.newOwnerId;
    property.currentOwnerId = transferRequest.newOwnerId;
    // Preserve originalOwnerId for future resales
    if (!property.originalOwnerId) {
      property.originalOwnerId = originalBuilderId;
    }
    property.status = LandStatus.OWNED;
    property.isResale = false; // No longer listed for resale

    await this.landRepository.save(property);

    // Update transfer request
    transferRequest.status = TransferRequestStatus.COMPLETED;
    transferRequest.completedAt = new Date();

    const savedRequest =
      await this.transferRequestRepository.save(transferRequest);

    // Update resale request to SOLD
    if (transferRequest.resaleRequest) {
      transferRequest.resaleRequest.status = ResaleRequestStatus.SOLD;
      await this.resaleRequestRepository.save(transferRequest.resaleRequest);
    }

    // Load with all relations
    const requestComplete = await this.transferRequestRepository.findOne({
      where: { id: transferRequestId },
      relations: ['documents', 'property', 'currentOwner', 'newOwner'],
    });

    return TransferRequestResponseDto.fromEntity(requestComplete!, true);
  }

  /**
   * Find owner's transfer requests
   */
  async findOwnerTransferRequests(
    ownerId: string,
    query: QueryTransferRequestsDto,
  ): Promise<{
    data: TransferRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, propertyId, resaleRequestId } = query;

    const queryBuilder =
      this.transferRequestRepository.createQueryBuilder('request');

    queryBuilder.where('request.currentOwnerId = :ownerId', { ownerId });

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (propertyId) {
      queryBuilder.andWhere('request.propertyId = :propertyId', { propertyId });
    }

    if (resaleRequestId) {
      queryBuilder.andWhere('request.resaleRequestId = :resaleRequestId', {
        resaleRequestId,
      });
    }

    const [requests, total] = await queryBuilder
      .leftJoinAndSelect('request.property', 'property')
      .leftJoinAndSelect('request.newOwner', 'newOwner')
      .leftJoinAndSelect('request.documents', 'documents')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        TransferRequestResponseDto.fromEntity(request, true),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Find builder's transfer requests
   */
  async findBuilderTransferRequests(
    builderId: string,
    query: QueryTransferRequestsDto,
  ): Promise<{
    data: TransferRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, propertyId, resaleRequestId } = query;

    // Get all properties where builder is the original owner
    const properties = await this.landRepository.find({
      where: [{ originalOwnerId: builderId }, { ownerId: builderId }],
      select: ['id'],
    });

    const propertyIds = properties.map((p) => p.id);

    if (propertyIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    const queryBuilder =
      this.transferRequestRepository.createQueryBuilder('request');

    queryBuilder.where('request.propertyId IN (:...propertyIds)', {
      propertyIds,
    });

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (propertyId) {
      queryBuilder.andWhere('request.propertyId = :propertyId', { propertyId });
    }

    if (resaleRequestId) {
      queryBuilder.andWhere('request.resaleRequestId = :resaleRequestId', {
        resaleRequestId,
      });
    }

    const [requests, total] = await queryBuilder
      .leftJoinAndSelect('request.property', 'property')
      .leftJoinAndSelect('request.currentOwner', 'currentOwner')
      .leftJoinAndSelect('request.newOwner', 'newOwner')
      .leftJoinAndSelect('request.documents', 'documents')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        TransferRequestResponseDto.fromEntity(request, true),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Find all transfer requests (admin)
   */
  async findAll(query: QueryTransferRequestsDto): Promise<{
    data: TransferRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      status,
      propertyId,
      currentOwnerId,
      newOwnerId,
      resaleRequestId,
    } = query;

    const queryBuilder =
      this.transferRequestRepository.createQueryBuilder('request');

    if (status) {
      queryBuilder.where('request.status = :status', { status });
    }

    if (propertyId) {
      queryBuilder.andWhere('request.propertyId = :propertyId', { propertyId });
    }

    if (currentOwnerId) {
      queryBuilder.andWhere('request.currentOwnerId = :currentOwnerId', {
        currentOwnerId,
      });
    }

    if (newOwnerId) {
      queryBuilder.andWhere('request.newOwnerId = :newOwnerId', { newOwnerId });
    }

    if (resaleRequestId) {
      queryBuilder.andWhere('request.resaleRequestId = :resaleRequestId', {
        resaleRequestId,
      });
    }

    const [requests, total] = await queryBuilder
      .leftJoinAndSelect('request.property', 'property')
      .leftJoinAndSelect('request.currentOwner', 'currentOwner')
      .leftJoinAndSelect('request.newOwner', 'newOwner')
      .leftJoinAndSelect('request.documents', 'documents')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        TransferRequestResponseDto.fromEntity(request, true),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Find one transfer request by ID
   */
  async findOne(id: string): Promise<TransferRequestResponseDto> {
    const request = await this.transferRequestRepository.findOne({
      where: { id },
      relations: ['property', 'currentOwner', 'newOwner', 'documents'],
    });

    if (!request) {
      throw new NotFoundException('Transfer request not found');
    }

    return TransferRequestResponseDto.fromEntity(request, true);
  }

  /**
   * Admin reviews transfer request and approves/rejects (NEW)
   */
  async adminReviewTransfer(
    transferRequestId: string,
    adminId: string,
    reviewDto: TransferAdminReviewDto,
  ): Promise<TransferRequestResponseDto> {
    const transferRequest = await this.transferRequestRepository.findOne({
      where: { id: transferRequestId },
      relations: [
        'resaleRequest',
        'property',
        'documents',
        'currentOwner',
        'newOwner',
      ],
    });

    if (!transferRequest) {
      throw new NotFoundException('Transfer request not found');
    }

    // Verify admin role
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only admins can review transfer requests',
      );
    }

    // Verify status
    if (
      transferRequest.status !== TransferRequestStatus.PENDING_ADMIN_APPROVAL
    ) {
      throw new BadRequestException(
        `Cannot review transfer request with status "${transferRequest.status}"`,
      );
    }

    // Validate rejection reason
    if (
      reviewDto.action === TransferAdminAction.REJECT &&
      !reviewDto.rejectionReason
    ) {
      throw new BadRequestException(
        'Rejection reason is required when rejecting',
      );
    }

    const now = new Date();

    if (reviewDto.action === TransferAdminAction.APPROVE) {
      // Approve the transfer
      transferRequest.status = TransferRequestStatus.APPROVED;
      transferRequest.reviewedBy = adminId;
      transferRequest.reviewedAt = now;
      transferRequest.adminNotes = reviewDto.adminNotes || null;

      await this.transferRequestRepository.save(transferRequest);

      // TODO: Send notification to builder and seller that transfer is approved
      // Builder/Admin can now call completeTransfer to finalize ownership
    } else if (reviewDto.action === TransferAdminAction.REJECT) {
      // Reject the transfer
      transferRequest.status = TransferRequestStatus.REJECTED;
      transferRequest.reviewedBy = adminId;
      transferRequest.reviewedAt = now;
      transferRequest.adminNotes = reviewDto.adminNotes || null;
      transferRequest.rejectionReason = reviewDto.rejectionReason || null;

      await this.transferRequestRepository.save(transferRequest);

      // TODO: Send notification to builder with rejection reason
    }

    // Reload with updated relations
    const updatedRequest = await this.transferRequestRepository.findOne({
      where: { id: transferRequestId },
      relations: [
        'documents',
        'property',
        'currentOwner',
        'newOwner',
        'reviewer',
      ],
    });

    return TransferRequestResponseDto.fromEntity(updatedRequest!, true);
  }

  /**
   * Get pending transfer requests for admin review (NEW)
   */
  async getPendingForAdmin(): Promise<TransferRequestResponseDto[]> {
    const pendingRequests = await this.transferRequestRepository.find({
      where: { status: TransferRequestStatus.PENDING_ADMIN_APPROVAL },
      relations: [
        'property',
        'currentOwner',
        'newOwner',
        'documents',
        'resaleRequest',
      ],
      order: { createdAt: 'DESC' },
    });

    return pendingRequests.map((request) =>
      TransferRequestResponseDto.fromEntity(request, true),
    );
  }
}
