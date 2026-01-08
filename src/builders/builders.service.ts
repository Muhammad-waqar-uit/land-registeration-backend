import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { BuilderResponseDto } from './dto/builder-response.dto';
import { VerifyBuilderDto } from './dto/verify-builder.dto';

@Injectable()
export class BuildersService {
  private readonly logger = new Logger(BuildersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
  ) {}

  /**
   * Verify a builder (Admin only)
   */
  async verifyBuilder(
    builderId: string,
    adminId: string,
    verifyDto?: VerifyBuilderDto,
  ): Promise<BuilderResponseDto> {
    const builder = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    if (builder.role !== UserRole.BUILDER) {
      throw new BadRequestException('User is not a builder');
    }

    if (builder.isBuilderVerified) {
      throw new BadRequestException('Builder is already verified');
    }

    // Verify the builder
    builder.isBuilderVerified = true;
    builder.builderVerifiedAt = new Date();
    builder.verifiedBy = adminId;

    const verifiedBuilder = await this.userRepository.save(builder);
    this.logger.log(`Builder ${builderId} verified by admin ${adminId}`);

    return BuilderResponseDto.fromEntity(verifiedBuilder);
  }

  /**
   * Get builder profile by ID
   */
  async findOne(builderId: string): Promise<BuilderResponseDto> {
    const builder = await this.userRepository.findOne({
      where: { id: builderId, role: UserRole.BUILDER },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    return BuilderResponseDto.fromEntity(builder);
  }

  /**
   * Get current builder profile
   */
  async getCurrentBuilder(builderId: string): Promise<BuilderResponseDto> {
    return this.findOne(builderId);
  }

  /**
   * Update builder profile
   */
  async updateProfile(
    builderId: string,
    updateData: {
      name?: string;
      email?: string;
      companyName?: string;
      licenseNumber?: string;
      cnic?: string;
      fatherName?: string;
      phoneNumber?: string;
    },
  ): Promise<BuilderResponseDto> {
    const builder = await this.userRepository.findOne({
      where: { id: builderId, role: UserRole.BUILDER },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    // Check if email is being updated and if it's already taken
    if (updateData.email && updateData.email !== builder.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateData.email },
      });

      if (existingUser) {
        throw new BadRequestException('Email is already taken');
      }
      builder.email = updateData.email;
    }

    // Check if license number is being updated and if it's already taken
    if (updateData.licenseNumber && updateData.licenseNumber !== builder.licenseNumber) {
      const existingBuilder = await this.userRepository.findOne({
        where: { licenseNumber: updateData.licenseNumber },
      });

      if (existingBuilder && existingBuilder.id !== builderId) {
        throw new BadRequestException('License number is already taken');
      }
      builder.licenseNumber = updateData.licenseNumber;
    }

    // Update other fields
    if (updateData.name !== undefined) builder.name = updateData.name;
    if (updateData.companyName !== undefined) builder.companyName = updateData.companyName;
    if (updateData.cnic !== undefined) builder.cnic = updateData.cnic;
    if (updateData.fatherName !== undefined) builder.fatherName = updateData.fatherName;
    if (updateData.phoneNumber !== undefined) builder.phoneNumber = updateData.phoneNumber;

    const updatedBuilder = await this.userRepository.save(builder);
    return BuilderResponseDto.fromEntity(updatedBuilder);
  }

  /**
   * List all builders (with optional filter for verified)
   */
  async findAll(verifiedOnly: boolean = false): Promise<BuilderResponseDto[]> {
    const where: any = { role: UserRole.BUILDER };
    if (verifiedOnly) {
      where.isBuilderVerified = true;
    }

    const builders = await this.userRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return builders.map((builder) => BuilderResponseDto.fromEntity(builder));
  }

  /**
   * Get builder's projects
   */
  async getBuilderProjects(builderId: string): Promise<Project[]> {
    const builder = await this.userRepository.findOne({
      where: { id: builderId, role: UserRole.BUILDER },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    return this.projectRepository.find({
      where: { builderId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get builder's properties
   */
  async getBuilderProperties(builderId: string): Promise<Land[]> {
    const builder = await this.userRepository.findOne({
      where: { id: builderId, role: UserRole.BUILDER },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    return this.landRepository.find({
      where: { ownerId: builderId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get builder dashboard stats
   */
  async getDashboardStats(builderId: string): Promise<{
    totalProjects: number;
    totalProperties: number;
    availableProperties: number;
    soldProperties: number;
    totalSales: number;
  }> {
    const builder = await this.userRepository.findOne({
      where: { id: builderId, role: UserRole.BUILDER },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    const [totalProjects, properties] = await Promise.all([
      this.projectRepository.count({ where: { builderId } }),
      this.landRepository.find({ where: { ownerId: builderId } }),
    ]);

    const totalProperties = properties.length;
    const availableProperties = properties.filter(
      (p) => p.status === LandStatus.AVAILABLE || p.status === LandStatus.RESERVED,
    ).length;
    const soldProperties = properties.filter(
      (p) => p.status === LandStatus.OWNED || p.status === LandStatus.SOLD,
    ).length;

    // Calculate total sales (sum of prices of sold properties)
    const totalSales = properties
      .filter((p) => p.status === 'owned' || p.status === 'sold')
      .reduce((sum, p) => sum + Number(p.price || 0), 0);

    return {
      totalProjects,
      totalProperties,
      availableProperties,
      soldProperties,
      totalSales,
    };
  }
}

