import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { BuilderResponseDto } from './dto/builder-response.dto';
import { VerifyBuilderDto } from './dto/verify-builder.dto';
import { RegisterBuilderDto } from './dto/register-builder.dto';
import { PropertyRequestsService } from '../property-requests/property-requests.service';
import { QueryPropertyRequestsDto } from '../property-requests/dto/query-property-requests.dto';

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
    private propertyRequestsService: PropertyRequestsService,
  ) {}

  /**
   * Register/Request builder status
   * Allows a user to request builder status by providing company info
   * Requires admin verification before they can operate as a builder
   */
  async registerBuilder(
    userId: string,
    registerDto: RegisterBuilderDto,
  ): Promise<BuilderResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if license number is already taken by another user
    const existingBuilder = await this.userRepository.findOne({
      where: { licenseNumber: registerDto.licenseNumber },
    });

    if (existingBuilder && existingBuilder.id !== userId) {
      throw new ConflictException('License number is already registered');
    }

    // If user is already a builder, just update their info
    if (user.role === UserRole.BUILDER) {
      // Update builder info
      if (registerDto.companyName) user.companyName = registerDto.companyName;
      if (registerDto.licenseNumber)
        user.licenseNumber = registerDto.licenseNumber;
      if (registerDto.cnic) user.cnic = registerDto.cnic;
      if (registerDto.phoneNumber) user.phoneNumber = registerDto.phoneNumber;

      // Reset verification status if license number changed
      if (
        registerDto.licenseNumber &&
        user.licenseNumber !== registerDto.licenseNumber
      ) {
        user.isBuilderVerified = false;
        user.builderVerifiedAt = null;
        user.verifiedBy = null;
      }

      const updatedBuilder = await this.userRepository.save(user);
      this.logger.log(`Builder info updated for user ${userId}`);
      return BuilderResponseDto.fromEntity(updatedBuilder);
    }

    // Convert user to builder role
    user.role = UserRole.BUILDER;
    user.companyName = registerDto.companyName;
    user.licenseNumber = registerDto.licenseNumber;
    if (registerDto.cnic) user.cnic = registerDto.cnic;
    if (registerDto.phoneNumber) user.phoneNumber = registerDto.phoneNumber;
    user.isBuilderVerified = false; // Requires admin verification
    user.builderVerifiedAt = null;
    user.verifiedBy = null;

    const newBuilder = await this.userRepository.save(user);
    this.logger.log(
      `User ${userId} registered as builder (pending verification)`,
    );

    return BuilderResponseDto.fromEntity(newBuilder);
  }

  /**
   * Verify a builder (Admin only)
   */
  async verifyBuilder(
    builderId: string,
    adminId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _verifyDto?: VerifyBuilderDto,
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
    // First find the user by ID
    const user = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify they have builder role
    if (user.role !== UserRole.BUILDER) {
      throw new BadRequestException(
        'User is not a builder. Please register as a builder first.',
      );
    }

    return BuilderResponseDto.fromEntity(user);
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
    // First find the user by ID
    const user = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify they have builder role
    if (user.role !== UserRole.BUILDER) {
      throw new BadRequestException(
        'User does not have builder role. Please register as a builder first.',
      );
    }

    const builder = user;

    // Check if email is being updated and if it's already taken
    if (updateData.email && builder.email && updateData.email !== builder.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateData.email },
      });

      if (existingUser) {
        throw new BadRequestException('Email is already taken');
      }
      builder.email = updateData.email;
    }

    // Check if license number is being updated and if it's already taken
    if (
      updateData.licenseNumber &&
      updateData.licenseNumber !== builder.licenseNumber
    ) {
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
    if (updateData.companyName !== undefined)
      builder.companyName = updateData.companyName;
    if (updateData.cnic !== undefined) builder.cnic = updateData.cnic;
    if (updateData.fatherName !== undefined)
      builder.fatherName = updateData.fatherName;
    if (updateData.phoneNumber !== undefined)
      builder.phoneNumber = updateData.phoneNumber;

    const updatedBuilder = await this.userRepository.save(builder);
    return BuilderResponseDto.fromEntity(updatedBuilder);
  }

  /**
   * List all builders (with optional filter for verified)
   */
  async findAll(verifiedOnly: boolean = false): Promise<BuilderResponseDto[]> {
    const where: { role: UserRole; isBuilderVerified?: boolean } = {
      role: UserRole.BUILDER,
    };
    if (verifiedOnly) {
      where.isBuilderVerified = true;
    }

    const builders = await this.userRepository.find({
      where: where as { role: UserRole } & { isBuilderVerified?: boolean },
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
      (p) =>
        p.status === LandStatus.AVAILABLE || p.status === LandStatus.RESERVED,
    ).length;
    const soldProperties = properties.filter(
      (p) => p.status === LandStatus.OWNED || p.status === LandStatus.SOLD,
    ).length;

    // Calculate total sales (sum of prices of sold properties)
    const totalSales = properties
      .filter(
        (p) => p.status === LandStatus.OWNED || p.status === LandStatus.SOLD,
      )
      .reduce((sum, p) => sum + Number(p.price || 0), 0);

    return {
      totalProjects,
      totalProperties,
      availableProperties,
      soldProperties,
      totalSales,
    };
  }

  /**
   * Get all property requests for builder's properties
   */
  async getBuilderPropertyRequests(
    builderId: string,
    query?: QueryPropertyRequestsDto,
  ) {
    const builder = await this.userRepository.findOne({
      where: { id: builderId, role: UserRole.BUILDER },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    return this.propertyRequestsService.findBuilderRequests(
      builderId,
      query || { page: 1, limit: 10 },
    );
  }
}
