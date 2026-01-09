import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Land, LandStatus } from '../entities/land.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { User, UserRole } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { CreateLandDto } from './dto/create-land.dto';
import { UpdateLandDto } from './dto/update-land.dto';
import { QueryLandsDto } from './dto/query-lands.dto';
import { LandResponseDto } from './dto/land-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';
import { IpfsService } from '../common/services/ipfs.service';
import { HashService } from '../common/services/hash.service';
import { BlockchainService } from '../common/services/blockchain.service';
import { ethers } from 'ethers';

@Injectable()
export class LandsService {
  constructor(
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    private fileStorageService: FileStorageService,
    private ipfsService: IpfsService,
    private hashService: HashService,
    private blockchainService: BlockchainService,
  ) {}

  async findAll(query: QueryLandsDto): Promise<{
    data: LandResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      status,
      projectId,
      builderId,
      ownerId,
      minPrice,
      maxPrice,
      isResale,
    } = query;

    const queryBuilder = this.landRepository.createQueryBuilder('land');

    // Apply filters
    if (status) {
      queryBuilder.where('land.status = :status', { status });
    }

    if (projectId) {
      queryBuilder.andWhere('land.projectId = :projectId', { projectId });
    }

    if (builderId) {
      queryBuilder.andWhere('land.ownerId = :builderId', { builderId });
    }

    if (ownerId) {
      queryBuilder.andWhere('land.ownerId = :ownerId', { ownerId });
    }

    if (isResale !== undefined) {
      queryBuilder.andWhere('land.isResale = :isResale', { isResale });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('land.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('land.price <= :maxPrice', { maxPrice });
    }

    const [lands, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('land.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: lands.map((land) => LandResponseDto.fromEntity(land)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, includeOwner = false): Promise<LandResponseDto> {
    const land = await this.landRepository.findOne({
      where: { id },
      relations: includeOwner ? ['owner'] : [],
    });

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    return LandResponseDto.fromEntity(land, includeOwner);
  }

  /**
   * Create a new property (Builder-Centric Model)
   *
   * Business Logic:
   * - Only verified builders can create properties (enforced by role guard and verification check)
   * - Properties must belong to a project (projectId is required and validated)
   * - Builder owns property until sold (ownerId is set to builderId)
   * - Builder must be verified before listing properties
   *
   * @param createLandDto Property creation data
   * @param documentFile Optional property document file
   * @param imageFile Optional property image file
   * @param builderId ID of the builder creating the property
   * @returns Created property
   */
  async create(
    createLandDto: CreateLandDto,
    documentFile: Express.Multer.File | undefined,
    imageFile: Express.Multer.File | undefined,
    builderId: string,
  ): Promise<LandResponseDto> {
    // Step 5.1: Validate builder role and verification status
    // Only builders can create properties (role guard enforced at controller level)
    const builder = await this.userRepository.findOne({
      where: { id: builderId, role: UserRole.BUILDER },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    // Builder must be verified to create properties
    if (!builder.isBuilderVerified) {
      throw new ForbiddenException(
        'Builder must be verified to create properties',
      );
    }

    // Step 5.1: Validate project ownership
    // Properties must belong to a project owned by the builder
    const project = await this.projectRepository.findOne({
      where: { id: createLandDto.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify project belongs to this builder
    if (project.builderId !== builderId) {
      throw new ForbiddenException('Project does not belong to this builder');
    }

    let documentCID: string | undefined;
    let documentUrl: string | undefined;
    let documentIPFSHash: string | undefined;
    let documentHash: string | undefined;
    let imageCID: string | undefined;
    let imageUrl: string | undefined;
    let imageIPFSHash: string | undefined;
    let imageHash: string | undefined;

    // Upload document file to local storage if provided
    if (documentFile) {
      const uploadResult = await this.fileStorageService.uploadFile(
        'land-documents',
        documentFile,
      );
      documentCID = uploadResult.path; // Store path
      documentUrl = uploadResult.url; // Store full URL

      // Calculate SHA-256 hash for tamper detection
      documentHash = this.hashService.calculateSHA256(documentFile.buffer);

      // Upload document to IPFS
      try {
        const ipfsResult = await this.ipfsService.uploadFile(documentFile);
        documentIPFSHash = this.ipfsService.formatIPFSHash(
          ipfsResult.hash,
          ipfsResult.gateway,
          ipfsResult.timestamp,
        );
      } catch (error) {
        console.error('Failed to upload document to IPFS:', error);
        // Continue without IPFS hash if upload fails
      }
    }

    // Upload image file to local storage if provided
    if (imageFile) {
      const uploadResult = await this.fileStorageService.uploadFile(
        'land-images',
        imageFile,
      );
      imageCID = uploadResult.path; // Store path
      imageUrl = uploadResult.url; // Store full URL

      // Calculate SHA-256 hash for tamper detection
      imageHash = this.hashService.calculateSHA256(imageFile.buffer);

      // Upload image to IPFS
      try {
        const ipfsResult = await this.ipfsService.uploadFile(imageFile);
        imageIPFSHash = this.ipfsService.formatIPFSHash(
          ipfsResult.hash,
          ipfsResult.gateway,
          ipfsResult.timestamp,
        );
      } catch (error) {
        console.error('Failed to upload image to IPFS:', error);
        // Continue without IPFS hash if upload fails
      }
    }

    // Builder must have wallet address
    if (!builder.walletAddress) {
      throw new BadRequestException(
        'Builder must have a wallet address to register property on blockchain',
      );
    }

    // Prepare IPFS hash (use document IPFS hash if available, otherwise empty string)
    const ipfsHash = documentIPFSHash || imageIPFSHash || '';

    // Convert price to wei (assuming price is in base currency, adjust if needed)
    // For now, we'll use the price as-is (you may need to adjust based on your token decimals)
    const priceInWei = BigInt(Math.floor(createLandDto.price * 1e18)); // Assuming 18 decimals

    // Register land on blockchain (if blockchain is configured)
    let blockchainLandId: number | undefined;
    let blockchainTxHash: string | undefined;

    if (this.blockchainService.isContractAvailable() && documentHash) {
      try {
        const blockchainResult = await this.blockchainService.registerLand(
          builder.walletAddress,
          ipfsHash,
          documentHash,
          priceInWei,
        );

        if (blockchainResult.success) {
          blockchainLandId = blockchainResult.landId;
          blockchainTxHash = blockchainResult.transactionHash;
        } else {
          // Log error but don't fail the land creation
          console.error(
            'Failed to register land on blockchain:',
            blockchainResult.error,
          );
        }
      } catch (error) {
        // Log error but don't fail the land creation
        console.error('Error registering land on blockchain:', error);
      }
    }

    // Calculate installment dates if installment plan is provided
    let installmentStartDate: Date | null = null;
    let installmentEndDate: Date | null = null;
    if (createLandDto.installmentPlanYears) {
      installmentStartDate = new Date();
      installmentEndDate = new Date();
      installmentEndDate.setFullYear(
        installmentEndDate.getFullYear() + createLandDto.installmentPlanYears,
      );
    }

    // Step 5.1: Builder owns property until sold
    // Property ownership is transferred to buyer only after full payment and final agreement
    const land = this.landRepository.create({
      ...createLandDto,
      ownerId: builderId, // Builder owns the property until sold (ownership transfer happens after payment completion)
      projectId: createLandDto.projectId, // Property must belong to a project
      isResale: createLandDto.isResale || false,
      installmentPlanYears: createLandDto.installmentPlanYears || null,
      installmentStartDate,
      installmentEndDate,
      totalPaid: 0,
      remainingBalance: createLandDto.price,
      documentCID,
      documentUrl,
      documentIPFSHash,
      documentHash,
      imageCID,
      imageUrl,
      imageIPFSHash,
      imageHash,
      blockchainLandId,
      blockchainTxHash,
    });

    const savedLand = await this.landRepository.save(land);
    return LandResponseDto.fromEntity(savedLand);
  }

  async update(
    id: string,
    updateLandDto: UpdateLandDto,
    documentFile: Express.Multer.File | undefined,
    imageFile: Express.Multer.File | undefined,
    userId: string,
    userRole: string,
  ): Promise<LandResponseDto> {
    const land = await this.landRepository.findOne({
      where: { id },
    });

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    // Check permission (builder/owner or admin)
    if (land.ownerId !== userId && (userRole as UserRole) !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to update this property',
      );
    }

    // Check if land can be updated (not reserved, agreement_pending, payment_in_progress, owned, or resale_listed)
    if ((userRole as UserRole) !== UserRole.ADMIN) {
      // Check land status - can't update if property has been sold or has active transactions
      if (
        land.status === LandStatus.RESERVED ||
        land.status === LandStatus.AGREEMENT_PENDING ||
        land.status === LandStatus.PAYMENT_IN_PROGRESS ||
        land.status === LandStatus.OWNED ||
        land.status === LandStatus.RESALE_LISTED ||
        land.status === LandStatus.SOLD
      ) {
        throw new BadRequestException(
          `Cannot update property with status "${land.status}". Property must be available.`,
        );
      }

      // Check for pending payments
      const pendingPayments = await this.paymentRepository.count({
        where: {
          landId: id,
          status: PaymentStatus.PENDING,
        },
      });

      if (pendingPayments > 0) {
        throw new BadRequestException(
          'Cannot update land with pending payments. Please resolve payments first.',
        );
      }
    }

    // Upload new document file if provided
    if (documentFile) {
      // Delete old file if exists
      if (land.documentCID) {
        try {
          const fileName = land.documentCID.split('/').pop();
          if (fileName) {
            await this.fileStorageService.deleteFile(
              'land-documents',
              fileName,
            );
          }
        } catch (error) {
          console.error('Error deleting old document file:', error);
        }
      }

      const uploadResult = await this.fileStorageService.uploadFile(
        'land-documents',
        documentFile,
      );
      land.documentCID = uploadResult.path;
      land.documentUrl = uploadResult.url;

      // Calculate SHA-256 hash for tamper detection
      land.documentHash = this.hashService.calculateSHA256(documentFile.buffer);

      // Upload document to IPFS
      try {
        const ipfsResult = await this.ipfsService.uploadFile(documentFile);
        land.documentIPFSHash = this.ipfsService.formatIPFSHash(
          ipfsResult.hash,
          ipfsResult.gateway,
          ipfsResult.timestamp,
        );
      } catch (error) {
        console.error('Failed to upload document to IPFS:', error);
      }
    }

    // Upload new image file if provided
    if (imageFile) {
      // Delete old image file if exists
      if (land.imageCID) {
        try {
          const fileName = land.imageCID.split('/').pop();
          if (fileName) {
            await this.fileStorageService.deleteFile('land-images', fileName);
          }
        } catch (error) {
          console.error('Error deleting old image file:', error);
        }
      }

      const uploadResult = await this.fileStorageService.uploadFile(
        'land-images',
        imageFile,
      );
      land.imageCID = uploadResult.path;
      land.imageUrl = uploadResult.url;

      // Calculate SHA-256 hash for tamper detection
      land.imageHash = this.hashService.calculateSHA256(imageFile.buffer);

      // Upload image to IPFS
      try {
        const ipfsResult = await this.ipfsService.uploadFile(imageFile);
        land.imageIPFSHash = this.ipfsService.formatIPFSHash(
          ipfsResult.hash,
          ipfsResult.gateway,
          ipfsResult.timestamp,
        );
      } catch (error) {
        console.error('Failed to upload image to IPFS:', error);
      }
    }

    // Update blockchain if land is registered and changes are made
    let newDocumentHash: string | undefined;
    let newIpfsHash: string | undefined;
    let newPrice: bigint | undefined;

    // Check if document was updated
    if (documentFile && land.documentHash) {
      newDocumentHash = land.documentHash; // Already calculated above
    }

    // Check if IPFS hash was updated
    if (land.documentIPFSHash) {
      newIpfsHash = land.documentIPFSHash;
    } else if (land.imageIPFSHash) {
      newIpfsHash = land.imageIPFSHash;
    }

    // Check if price was updated
    if (updateLandDto.price !== undefined) {
      newPrice = BigInt(Math.floor(updateLandDto.price * 1e18));
    }

    // Update blockchain if configured and land is registered
    if (
      this.blockchainService.isContractAvailable() &&
      land.blockchainLandId &&
      (newDocumentHash || newIpfsHash || newPrice)
    ) {
      try {
        const updateResult = await this.blockchainService.updateLand(
          land.blockchainLandId,
          newIpfsHash || '',
          newDocumentHash || '',
          newPrice || BigInt(0),
        );

        if (updateResult.success && updateResult.transactionHash) {
          // Store update transaction hash (could add a separate field for this)
          // For now, we'll note it in logs
          console.log(
            `Land ${land.id} updated on blockchain. TX: ${updateResult.transactionHash}`,
          );
          if (updateResult.requiresSellerApproval) {
            console.log(
              `⚠️ Document hash change requires seller approval for land ${land.id}`,
            );
          }
        } else {
          console.error(
            'Failed to update land on blockchain:',
            updateResult.error,
          );
        }
      } catch (error) {
        // Log error but don't fail the update
        console.error('Error updating land on blockchain:', error);
      }
    }

    Object.assign(land, updateLandDto);
    const updatedLand = await this.landRepository.save(land);

    return LandResponseDto.fromEntity(updatedLand);
  }

  async remove(id: string, userId: string, userRole: UserRole): Promise<void> {
    const land = await this.landRepository.findOne({
      where: { id },
    });

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    // Check permission (builder/owner or admin)
    if (
      land.ownerId !== userId &&
      (userRole as unknown as UserRole) !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to delete this property',
      );
    }

    // Check if land can be deleted (must be available, no transactions)
    if ((userRole as unknown as UserRole) !== UserRole.ADMIN) {
      // Check land status - can only delete if available
      if (land.status !== LandStatus.AVAILABLE) {
        throw new BadRequestException(
          `Cannot delete property with status "${land.status}". Property must be available.`,
        );
      }

      // Check for any payments (pending, verified, or rejected)
      const paymentCount = await this.paymentRepository.count({
        where: { landId: id },
      });

      if (paymentCount > 0) {
        throw new BadRequestException(
          'Cannot delete land with existing payments. This land has transaction history.',
        );
      }
    }

    // Delete document file from storage if exists
    if (land.documentCID) {
      try {
        const fileName = land.documentCID.split('/').pop();
        if (fileName) {
          await this.fileStorageService.deleteFile('land-documents', fileName);
        }
      } catch (error) {
        console.error('Error deleting document file:', error);
      }
    }

    // Delete image file from storage if exists
    if (land.imageCID) {
      try {
        const fileName = land.imageCID.split('/').pop();
        if (fileName) {
          await this.fileStorageService.deleteFile('land-images', fileName);
        }
      } catch (error) {
        console.error('Error deleting image file:', error);
      }
    }

    await this.landRepository.remove(land);
  }

  /**
   * Verify a single file integrity by comparing SHA-256 hash
   * @param land - Land entity
   * @param fileType - 'document' or 'image'
   * @returns Verification result for the file
   */
  private async verifyFile(
    land: Land,
    fileType: 'document' | 'image',
  ): Promise<{
    verified: boolean;
    message: string;
    storedHash?: string;
    calculatedHash?: string;
  }> {
    const storedHash =
      fileType === 'document' ? land.documentHash : land.imageHash;
    const filePath = fileType === 'document' ? land.documentCID : land.imageCID;
    const fileTypeName = fileType === 'document' ? 'document' : 'image';
    const bucket = fileType === 'document' ? 'land-documents' : 'land-images';

    if (!storedHash || !filePath) {
      return {
        verified: false,
        message: `${fileTypeName} not available for verification.`,
      };
    }

    try {
      // Extract filename from path (e.g., "land-documents/1234567890-doc.pdf" -> "1234567890-doc.pdf")
      const fileName = filePath.split('/').pop() || filePath;

      // Read file from storage
      const fileBuffer = await this.fileStorageService.readFile(
        bucket,
        fileName,
      );

      // Calculate hash of stored file
      const calculatedHash = this.hashService.calculateSHA256(fileBuffer);
      const verified = this.hashService.verifyHash(fileBuffer, storedHash);

      if (verified) {
        return {
          verified: true,
          message: `${fileTypeName} is genuine and has not been tampered with.`,
          storedHash,
          calculatedHash,
        };
      } else {
        return {
          verified: false,
          message: `${fileTypeName} verification failed. The file may have been tampered with.`,
          storedHash,
          calculatedHash,
        };
      }
    } catch (error) {
      return {
        verified: false,
        message: `Failed to read ${fileTypeName} file: ${(error as Error).message}`,
        storedHash,
      };
    }
  }

  /**
   * Verify document and image integrity by comparing SHA-256 hashes
   * Reads stored files from uploads and compares their hashes with stored hashes in database
   * @param landId - Land ID
   * @returns Verification result for both document and image
   */
  async verifyDocumentIntegrity(landId: string): Promise<{
    verified: boolean;
    message: string;
    document?: {
      verified: boolean;
      message: string;
      storedHash?: string;
      calculatedHash?: string;
    };
    image?: {
      verified: boolean;
      message: string;
      storedHash?: string;
      calculatedHash?: string;
    };
  }> {
    const land = await this.landRepository.findOne({
      where: { id: landId },
    });

    if (!land) {
      return {
        verified: false,
        message: 'Land not found',
      };
    }

    // Verify both document and image
    const documentResult = await this.verifyFile(land, 'document');
    const imageResult = await this.verifyFile(land, 'image');

    // Determine overall verification status
    const hasDocument = land.documentHash && land.documentCID;
    const hasImage = land.imageHash && land.imageCID;

    let overallVerified = true;
    let overallMessage = '';

    if (hasDocument && hasImage) {
      // Both files exist - both must be verified
      overallVerified = documentResult.verified && imageResult.verified;
      overallMessage = overallVerified
        ? 'All files verified successfully.'
        : 'Some files failed verification.';
    } else if (hasDocument) {
      // Only document exists
      overallVerified = documentResult.verified;
      overallMessage = overallVerified
        ? 'Document verified successfully.'
        : 'Document verification failed.';
    } else if (hasImage) {
      // Only image exists
      overallVerified = imageResult.verified;
      overallMessage = overallVerified
        ? 'Image verified successfully.'
        : 'Image verification failed.';
    } else {
      // No files to verify
      return {
        verified: false,
        message:
          'No files available for verification. This land has no document or image uploaded.',
      };
    }

    const result: {
      verified: boolean;
      message: string;
      document?: {
        verified: boolean;
        message: string;
        storedHash?: string;
        calculatedHash?: string;
      };
      image?: {
        verified: boolean;
        message: string;
        storedHash?: string;
        calculatedHash?: string;
      };
    } = {
      verified: overallVerified,
      message: overallMessage,
    };

    if (hasDocument) {
      result.document = documentResult;
    }

    if (hasImage) {
      result.image = imageResult;
    }

    return result;
  }

  /**
   * Verify document hash against blockchain
   * @param landId - Database land ID
   * @returns Verification result comparing database hash with blockchain hash
   */
  async verifyBlockchainHash(landId: string): Promise<{
    verified: boolean;
    message: string;
    databaseHash?: string;
    blockchainHash?: string;
    blockchainLandId?: number;
    error?: string;
  }> {
    const land = await this.landRepository.findOne({
      where: { id: landId },
    });

    if (!land) {
      return {
        verified: false,
        message: 'Land not found',
      };
    }

    if (!land.blockchainLandId) {
      return {
        verified: false,
        message: 'Land is not registered on blockchain',
      };
    }

    if (!land.documentHash) {
      return {
        verified: false,
        message: 'Document hash not available in database',
      };
    }

    if (!this.blockchainService.isContractAvailable()) {
      return {
        verified: false,
        message:
          'Blockchain service not available. Please configure blockchain settings.',
      };
    }

    try {
      const verified = await this.blockchainService.verifyDocumentHash(
        land.blockchainLandId,
        land.documentHash,
      );

      if (verified) {
        // Get blockchain hash for comparison display
        const blockchainData =
          await this.blockchainService.getLandFromBlockchain(
            land.blockchainLandId,
          );

        return {
          verified: true,
          message:
            'Document hash matches blockchain record. Document is authentic.',
          databaseHash: land.documentHash,
          blockchainHash: blockchainData
            ? ethers.hexlify(blockchainData.documentHash)
            : undefined,
          blockchainLandId: land.blockchainLandId,
        };
      } else {
        const blockchainData =
          await this.blockchainService.getLandFromBlockchain(
            land.blockchainLandId,
          );

        return {
          verified: false,
          message:
            'Document hash does not match blockchain record. Document may have been tampered with.',
          databaseHash: land.documentHash,
          blockchainHash: blockchainData
            ? ethers.hexlify(blockchainData.documentHash)
            : undefined,
          blockchainLandId: land.blockchainLandId,
        };
      }
    } catch (error) {
      return {
        verified: false,
        message: `Error verifying against blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        blockchainLandId: land.blockchainLandId,
      };
    }
  }

  /**
   * Get properties available for purchase requests (available properties from builders)
   * These are properties that buyers can submit purchase requests for
   */
  async findAvailableForRequest(query: QueryLandsDto): Promise<{
    data: LandResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      projectId,
      builderId,
      minPrice,
      maxPrice,
    } = query;

    const queryBuilder = this.landRepository.createQueryBuilder('land');

    // Only available properties from builders
    queryBuilder
      .where('land.status = :status', { status: LandStatus.AVAILABLE })
      .andWhere('land.isResale = :isResale', { isResale: false });

    // Join with User to filter by builder role
    queryBuilder
      .innerJoin('land.owner', 'owner')
      .andWhere('owner.role = :role', { role: UserRole.BUILDER })
      .andWhere('owner.isBuilderVerified = :verified', { verified: true });

    if (projectId) {
      queryBuilder.andWhere('land.projectId = :projectId', { projectId });
    }

    if (builderId) {
      queryBuilder.andWhere('land.ownerId = :builderId', { builderId });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('land.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('land.price <= :maxPrice', { maxPrice });
    }

    const [lands, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('land.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: lands.map((land) => LandResponseDto.fromEntity(land)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get resale properties (properties listed for resale)
   */
  async findResaleProperties(query: QueryLandsDto): Promise<{
    data: LandResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      projectId,
      builderId,
      minPrice,
      maxPrice,
    } = query;

    const queryBuilder = this.landRepository.createQueryBuilder('land');

    // Resale properties (either marked as resale or have RESALE_LISTED status)
    queryBuilder.where(
      '(land.isResale = :isResale OR land.status = :resaleStatus)',
      { isResale: true, resaleStatus: LandStatus.RESALE_LISTED },
    );

    if (projectId) {
      queryBuilder.andWhere('land.projectId = :projectId', { projectId });
    }

    if (builderId) {
      queryBuilder.andWhere('land.ownerId = :builderId', { builderId });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('land.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('land.price <= :maxPrice', { maxPrice });
    }

    const [lands, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('land.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: lands.map((land) => LandResponseDto.fromEntity(land)),
      total,
      page,
      limit,
    };
  }

  /**
   * Check if a property is eligible for purchase requests
   * Property must be available and belong to a verified builder
   */
  async isEligibleForRequest(propertyId: string): Promise<{
    eligible: boolean;
    message: string;
    property?: Land;
  }> {
    const property = await this.landRepository.findOne({
      where: { id: propertyId },
      relations: ['owner'],
    });

    if (!property) {
      return {
        eligible: false,
        message: 'Property not found',
      };
    }

    if (property.status !== LandStatus.AVAILABLE) {
      return {
        eligible: false,
        message: `Property is not available (status: ${property.status})`,
        property,
      };
    }

    if (property.isResale) {
      return {
        eligible: false,
        message:
          'This is a resale property. Use resale request process instead.',
        property,
      };
    }

    const owner = await this.userRepository.findOne({
      where: { id: property.ownerId },
    });

    if (!owner || owner.role !== UserRole.BUILDER || !owner.isBuilderVerified) {
      return {
        eligible: false,
        message:
          'Property must belong to a verified builder to receive purchase requests',
        property,
      };
    }

    return {
      eligible: true,
      message: 'Property is eligible for purchase requests',
      property,
    };
  }

  /**
   * Check if a property is eligible for resale listing
   * Property must be owned (not by builder) and current owner must be requesting
   */
  async isEligibleForResale(
    propertyId: string,
    currentOwnerId: string,
  ): Promise<{
    eligible: boolean;
    message: string;
    property?: Land;
  }> {
    const property = await this.landRepository.findOne({
      where: { id: propertyId },
      relations: ['owner', 'originalOwner'],
    });

    if (!property) {
      return {
        eligible: false,
        message: 'Property not found',
      };
    }

    // Check if property is already listed for resale
    if (property.status === LandStatus.RESALE_LISTED) {
      return {
        eligible: false,
        message: 'Property is already listed for resale',
        property,
      };
    }

    if (property.status !== LandStatus.OWNED) {
      return {
        eligible: false,
        message: `Property must be owned to be listed for resale (current status: ${property.status})`,
        property,
      };
    }

    if (property.currentOwnerId !== currentOwnerId) {
      return {
        eligible: false,
        message: 'Only the current owner can request to resell this property',
        property,
      };
    }

    return {
      eligible: true,
      message: 'Property is eligible for resale listing',
      property,
    };
  }

  /**
   * Get properties by builder (properties created/owned by a specific builder)
   */
  async findByBuilder(
    builderId: string,
    query: QueryLandsDto,
  ): Promise<{
    data: LandResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      status,
      projectId,
      isResale,
      minPrice,
      maxPrice,
    } = query;

    const queryBuilder = this.landRepository.createQueryBuilder('land');

    queryBuilder.where('land.ownerId = :builderId', { builderId });

    if (status) {
      queryBuilder.andWhere('land.status = :status', { status });
    }

    if (projectId) {
      queryBuilder.andWhere('land.projectId = :projectId', { projectId });
    }

    if (isResale !== undefined) {
      queryBuilder.andWhere('land.isResale = :isResale', { isResale });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('land.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('land.price <= :maxPrice', { maxPrice });
    }

    const [lands, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('land.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: lands.map((land) => LandResponseDto.fromEntity(land)),
      total,
      page,
      limit,
    };
  }
}
