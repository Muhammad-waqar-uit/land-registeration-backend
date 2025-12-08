import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Land, LandStatus } from '../entities/land.entity';
import { User } from '../entities/user.entity';
import { CreateLandDto } from './dto/create-land.dto';
import { UpdateLandDto } from './dto/update-land.dto';
import { QueryLandsDto } from './dto/query-lands.dto';
import { LandResponseDto } from './dto/land-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';

@Injectable()
export class LandsService {
  constructor(
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    private fileStorageService: FileStorageService,
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
    file: Express.Multer.File | undefined,
    ownerId: string,
  ): Promise<LandResponseDto> {
    let documentCID: string | undefined;

    // Upload file to local storage if provided
    if (file) {
      const uploadResult = await this.fileStorageService.uploadFile(
        'land-documents',
        file,
      );
      documentCID = uploadResult.path; // Store path
    }

    const land = this.landRepository.create({
      ...createLandDto,
      ownerId,
      documentCID,
    });

    const savedLand = await this.landRepository.save(land);
    return LandResponseDto.fromEntity(savedLand);
  }

  async update(
    id: string,
    updateLandDto: UpdateLandDto,
    file: Express.Multer.File | undefined,
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

    // Upload new file if provided
    if (file) {
      // Delete old file if exists
      if (land.documentCID) {
        try {
          await this.fileStorageService.deleteFile(
            'land-documents',
            land.documentCID,
          );
        } catch (error) {
          console.error('Error deleting old file:', error);
        }
      }

      const uploadResult = await this.fileStorageService.uploadFile(
        'land-documents',
        file,
      );
      land.documentCID = uploadResult.path;
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

    // Delete file from storage if exists
    if (land.documentCID) {
      try {
        await this.fileStorageService.deleteFile(
          'land-documents',
          land.documentCID,
        );
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    await this.landRepository.remove(land);
  }
}
