import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Land, LandStatus } from '../entities/land.entity';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { CreateLandDto } from './dto/create-land.dto';
import { UpdateLandDto } from './dto/update-land.dto';
import { QueryLandsDto } from './dto/query-lands.dto';
import { LandResponseDto } from './dto/land-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';
import { IpfsService } from '../common/services/ipfs.service';
import { HashService } from '../common/services/hash.service';

@Injectable()
export class LandsService {
  constructor(
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private fileStorageService: FileStorageService,
    private ipfsService: IpfsService,
    private hashService: HashService,
  ) {}

  async findAll(query: QueryLandsDto): Promise<{
    data: LandResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, ownerId, minPrice, maxPrice } =
      query;

    const queryBuilder = this.landRepository.createQueryBuilder('land');

    if (status) {
      queryBuilder.where('land.status = :status', { status });
    }

    if (ownerId) {
      queryBuilder.andWhere('land.ownerId = :ownerId', { ownerId });
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

  async create(
    createLandDto: CreateLandDto,
    documentFile: Express.Multer.File | undefined,
    imageFile: Express.Multer.File | undefined,
    ownerId: string,
  ): Promise<LandResponseDto> {
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

    const land = this.landRepository.create({
      ...createLandDto,
      ownerId,
      documentCID,
      documentUrl,
      documentIPFSHash,
      documentHash,
      imageCID,
      imageUrl,
      imageIPFSHash,
      imageHash,
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

    // Check permission
    if (land.ownerId !== userId && userRole !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to update this land',
      );
    }

    // Check if land can be updated (not locked or sold, no active reservations, no pending payments)
    if (userRole !== 'admin') {
      // Check land status
      if (land.status === LandStatus.LOCKED || land.status === LandStatus.SOLD) {
        throw new BadRequestException(
          `Cannot update land with status "${land.status}". Land must be available.`,
        );
      }

      // Check for active reservations
      const activeReservations = await this.reservationRepository.count({
        where: {
          landId: id,
          status: ReservationStatus.ACTIVE,
        },
      });

      if (activeReservations > 0) {
        throw new BadRequestException(
          'Cannot update land with active reservations. Please cancel reservations first.',
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
            await this.fileStorageService.deleteFile('land-documents', fileName);
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

    Object.assign(land, updateLandDto);
    const updatedLand = await this.landRepository.save(land);

    return LandResponseDto.fromEntity(updatedLand);
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const land = await this.landRepository.findOne({
      where: { id },
    });

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    // Check permission
    if (land.ownerId !== userId && userRole !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to delete this land',
      );
    }

    // Check if land can be deleted (must be available, no reservations, no payments)
    if (userRole !== 'admin') {
      // Check land status
      if (land.status !== LandStatus.AVAILABLE) {
        throw new BadRequestException(
          `Cannot delete land with status "${land.status}". Land must be available.`,
        );
      }

      // Check for any reservations (active or cancelled)
      const reservationCount = await this.reservationRepository.count({
        where: { landId: id },
      });

      if (reservationCount > 0) {
        throw new BadRequestException(
          'Cannot delete land with existing reservations. This land has transaction history.',
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
  ): Promise<{ verified: boolean; message: string; storedHash?: string; calculatedHash?: string }> {
    const storedHash = fileType === 'document' ? land.documentHash : land.imageHash;
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
      const fileBuffer = await this.fileStorageService.readFile(bucket, fileName);
      
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
  async verifyDocumentIntegrity(
    landId: string,
  ): Promise<{
    verified: boolean;
    message: string;
    document?: { verified: boolean; message: string; storedHash?: string; calculatedHash?: string };
    image?: { verified: boolean; message: string; storedHash?: string; calculatedHash?: string };
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
        message: 'No files available for verification. This land has no document or image uploaded.',
      };
    }

    const result: {
      verified: boolean;
      message: string;
      document?: { verified: boolean; message: string; storedHash?: string; calculatedHash?: string };
      image?: { verified: boolean; message: string; storedHash?: string; calculatedHash?: string };
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
}
