import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ResaleRequest,
  ResaleRequestStatus,
} from '../entities/resale-request.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreateResaleRequestDto } from './dto/create-resale-request.dto';
import { RespondResaleRequestDto } from './dto/respond-resale-request.dto';
import { QueryResaleRequestsDto } from './dto/query-resale-requests.dto';
import { ResaleRequestResponseDto } from './dto/resale-request-response.dto';
import { LandsService } from '../lands/lands.service';

@Injectable()
export class ResaleRequestsService {
  constructor(
    @InjectRepository(ResaleRequest)
    private resaleRequestRepository: Repository<ResaleRequest>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private landsService: LandsService,
  ) {}

  /**
   * Create resale request (property owner action)
   */
  async createResaleRequest(
    createDto: CreateResaleRequestDto,
    currentOwnerId: string,
  ): Promise<ResaleRequestResponseDto> {
    // Check if property is eligible for resale
    const eligibility = await this.landsService.isEligibleForResale(
      createDto.propertyId,
      currentOwnerId,
    );

    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.message);
    }

    const property = eligibility.property!;

    // Find original builder (owner at creation)
    // For now, we'll use the originalOwnerId if available, otherwise use ownerId
    const builderId = property.originalOwnerId || property.ownerId;

    // Verify builder exists
    const builder = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (!builder) {
      throw new NotFoundException('Original builder not found');
    }

    // Check if there's already a pending or approved resale request
    const existingRequest = await this.resaleRequestRepository.findOne({
      where: {
        propertyId: createDto.propertyId,
        currentOwnerId: currentOwnerId,
        status: ResaleRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'You already have a pending resale request for this property',
      );
    }

    // Check for approved but not yet listed requests
    const approvedRequest = await this.resaleRequestRepository.findOne({
      where: {
        propertyId: createDto.propertyId,
        currentOwnerId: currentOwnerId,
        status: ResaleRequestStatus.APPROVED,
      },
    });

    if (approvedRequest) {
      throw new ConflictException(
        'You already have an approved resale request for this property. Please wait for it to be listed.',
      );
    }

    // Create resale request
    const resaleRequest = this.resaleRequestRepository.create({
      propertyId: createDto.propertyId,
      currentOwnerId: currentOwnerId,
      builderId: builderId,
      requestedPrice: createDto.requestedPrice,
      status: ResaleRequestStatus.PENDING,
    });

    const savedRequest = await this.resaleRequestRepository.save(resaleRequest);

    return ResaleRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * Builder approval/rejection of resale request
   */
  async respondToResaleRequest(
    requestId: string,
    respondDto: RespondResaleRequestDto,
    builderId: string,
  ): Promise<ResaleRequestResponseDto> {
    const request = await this.resaleRequestRepository.findOne({
      where: { id: requestId },
      relations: ['property'],
    });

    if (!request) {
      throw new NotFoundException('Resale request not found');
    }

    // Verify request belongs to this builder
    if (request.builderId !== builderId) {
      throw new ForbiddenException(
        'You are not authorized to respond to this resale request',
      );
    }

    // Verify builder is verified
    const builder = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (!builder || !builder.isBuilderVerified) {
      throw new ForbiddenException(
        'Only verified builders can respond to resale requests',
      );
    }

    // Check if request can be responded to
    if (request.status !== ResaleRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot respond to request with status "${request.status}". Only pending requests can be responded to.`,
      );
    }

    // Update request
    request.status = respondDto.status;
    request.approvedAt =
      respondDto.status === ResaleRequestStatus.APPROVED ? new Date() : null;

    const savedRequest = await this.resaleRequestRepository.save(request);

    return ResaleRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * List property as resale (builder action after approval)
   */
  async listPropertyAsResale(
    requestId: string,
    builderId: string,
  ): Promise<ResaleRequestResponseDto> {
    const request = await this.resaleRequestRepository.findOne({
      where: { id: requestId },
      relations: ['property'],
    });

    if (!request) {
      throw new NotFoundException('Resale request not found');
    }

    // Verify request belongs to this builder
    if (request.builderId !== builderId) {
      throw new ForbiddenException(
        'You are not authorized to list this property for resale',
      );
    }

    // Check if request is approved
    if (request.status !== ResaleRequestStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot list property with status "${request.status}". Request must be approved first.`,
      );
    }

    // Update property
    const property = await this.landRepository.findOne({
      where: { id: request.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Update property for resale
    property.status = LandStatus.RESALE_LISTED;
    property.isResale = true;
    property.price = request.requestedPrice; // Update price to resale price

    await this.landRepository.save(property);

    // Update request status
    request.status = ResaleRequestStatus.LISTED;
    request.listedAt = new Date();

    const savedRequest = await this.resaleRequestRepository.save(request);

    return ResaleRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * Mark resale property as sold (builder or admin action)
   */
  async markResaleAsSold(
    requestId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<ResaleRequestResponseDto> {
    const request = await this.resaleRequestRepository.findOne({
      where: { id: requestId },
      relations: ['property'],
    });

    if (!request) {
      throw new NotFoundException('Resale request not found');
    }

    // Verify authorization (builder or admin)
    if (userRole !== UserRole.ADMIN && request.builderId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to mark this property as sold',
      );
    }

    // Check if request is listed
    if (request.status !== ResaleRequestStatus.LISTED) {
      throw new BadRequestException(
        `Cannot mark property as sold with status "${request.status}". Property must be listed first.`,
      );
    }

    // Update property
    const property = await this.landRepository.findOne({
      where: { id: request.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Note: Property ownership transfer would happen through the normal purchase flow
    // This just marks the resale request as sold
    // The property status should be updated through the normal sale process

    // Update request status
    request.status = ResaleRequestStatus.SOLD;

    const savedRequest = await this.resaleRequestRepository.save(request);

    return ResaleRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * List property as resale (seller action after approval)
   */
  async listPropertyAsSeller(
    requestId: string,
    sellerId: string,
  ): Promise<ResaleRequestResponseDto> {
    const request = await this.resaleRequestRepository.findOne({
      where: { id: requestId },
      relations: ['property'],
    });

    if (!request) {
      throw new NotFoundException('Resale request not found');
    }

    // Verify request belongs to this seller (currentOwner)
    if (request.currentOwnerId !== sellerId) {
      throw new ForbiddenException(
        'You are not authorized to list this property for resale',
      );
    }

    // Check if request is approved
    if (request.status !== ResaleRequestStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot list property with status "${request.status}". Request must be approved first.`,
      );
    }

    // Update property
    const property = await this.landRepository.findOne({
      where: { id: request.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Update property for resale
    property.status = LandStatus.RESALE_LISTED;
    property.isResale = true;
    property.price = request.requestedPrice; // Update price to resale price

    await this.landRepository.save(property);

    // Update request status
    request.status = ResaleRequestStatus.LISTED;
    request.listedAt = new Date();

    const savedRequest = await this.resaleRequestRepository.save(request);

    return ResaleRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * List property owner's resale requests
   */
  async findOwnerResaleRequests(
    ownerId: string,
    query: QueryResaleRequestsDto,
  ): Promise<{
    data: ResaleRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, propertyId } = query;

    const queryBuilder =
      this.resaleRequestRepository.createQueryBuilder('request');

    queryBuilder.where('request.currentOwnerId = :ownerId', { ownerId });

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (propertyId) {
      queryBuilder.andWhere('request.propertyId = :propertyId', { propertyId });
    }

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        ResaleRequestResponseDto.fromEntity(request),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * List builder's resale requests
   */
  async findBuilderResaleRequests(
    builderId: string,
    query: QueryResaleRequestsDto,
  ): Promise<{
    data: ResaleRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, propertyId } = query;

    const queryBuilder =
      this.resaleRequestRepository.createQueryBuilder('request');

    queryBuilder.where('request.builderId = :builderId', { builderId });

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (propertyId) {
      queryBuilder.andWhere('request.propertyId = :propertyId', { propertyId });
    }

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        ResaleRequestResponseDto.fromEntity(request),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Find all resale requests with filters (admin or general query)
   */
  async findAll(query: QueryResaleRequestsDto): Promise<{
    data: ResaleRequestResponseDto[];
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
      builderId,
    } = query;

    const queryBuilder =
      this.resaleRequestRepository.createQueryBuilder('request');

    if (status) {
      queryBuilder.where('request.status = :status', { status });
    }

    if (propertyId) {
      queryBuilder.andWhere('request.propertyId = :propertyId', {
        propertyId,
      });
    }

    if (currentOwnerId) {
      queryBuilder.andWhere('request.currentOwnerId = :currentOwnerId', {
        currentOwnerId,
      });
    }

    if (builderId) {
      queryBuilder.andWhere('request.builderId = :builderId', { builderId });
    }

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        ResaleRequestResponseDto.fromEntity(request),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Find one resale request by ID
   */
  async findOne(id: string): Promise<ResaleRequestResponseDto> {
    const request = await this.resaleRequestRepository.findOne({
      where: { id },
      relations: ['property', 'currentOwner', 'builder'],
    });

    if (!request) {
      throw new NotFoundException('Resale request not found');
    }

    return ResaleRequestResponseDto.fromEntity(request);
  }
}
