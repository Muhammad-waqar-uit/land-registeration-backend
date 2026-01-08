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
  PropertyRequest,
  PropertyRequestStatus,
} from '../entities/property-request.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreatePropertyRequestDto } from './dto/create-property-request.dto';
import { RespondPropertyRequestDto } from './dto/respond-property-request.dto';
import { QueryPropertyRequestsDto } from './dto/query-property-requests.dto';
import { PropertyRequestResponseDto } from './dto/property-request-response.dto';
import { LandsService } from '../lands/lands.service';

@Injectable()
export class PropertyRequestsService {
  constructor(
    @InjectRepository(PropertyRequest)
    private propertyRequestRepository: Repository<PropertyRequest>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private landsService: LandsService,
  ) {}

  /**
   * Create purchase request (buyer action)
   */
  async createPropertyRequest(
    createDto: CreatePropertyRequestDto,
    buyerId: string,
  ): Promise<PropertyRequestResponseDto> {
    // Check if property is eligible for requests
    const eligibility = await this.landsService.isEligibleForRequest(
      createDto.propertyId,
    );

    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.message);
    }

    // Verify buyer exists
    const buyer = await this.userRepository.findOne({
      where: { id: buyerId },
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    // Check if buyer already has a pending request for this property
    const existingRequest = await this.propertyRequestRepository.findOne({
      where: {
        propertyId: createDto.propertyId,
        buyerId: buyerId,
        status: PropertyRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'You already have a pending request for this property',
      );
    }

    // Create property request
    const propertyRequest = this.propertyRequestRepository.create({
      propertyId: createDto.propertyId,
      buyerId: buyerId,
      status: PropertyRequestStatus.PENDING,
      requestedPrice: createDto.requestedPrice || null,
    });

    const savedRequest = await this.propertyRequestRepository.save(
      propertyRequest,
    );

    // Update property status to RESERVED
    const property = eligibility.property;
    if (property && property.status === LandStatus.AVAILABLE) {
      property.status = LandStatus.RESERVED;
      await this.landRepository.save(property);
    }

    return PropertyRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * Builder approval/rejection of property request
   */
  async respondToPropertyRequest(
    requestId: string,
    respondDto: RespondPropertyRequestDto,
    builderId: string,
  ): Promise<PropertyRequestResponseDto> {
    const request = await this.propertyRequestRepository.findOne({
      where: { id: requestId },
      relations: ['property'],
    });

    if (!request) {
      throw new NotFoundException('Property request not found');
    }

    // Verify property belongs to builder
    const property = await this.landRepository.findOne({
      where: { id: request.propertyId },
      relations: ['owner'],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.ownerId !== builderId) {
      throw new ForbiddenException(
        'You are not authorized to respond to this request',
      );
    }

    // Verify builder is verified
    const builder = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (!builder || !builder.isBuilderVerified) {
      throw new ForbiddenException(
        'Only verified builders can respond to property requests',
      );
    }

    // Check if request can be responded to
    if (request.status !== PropertyRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot respond to request with status "${request.status}". Only pending requests can be responded to.`,
      );
    }

    // Validate status
    if (
      respondDto.status !== PropertyRequestStatus.APPROVED &&
      respondDto.status !== PropertyRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Response status must be either APPROVED or REJECTED',
      );
    }

    // Update request
    request.status = respondDto.status;
    request.builderResponse = respondDto.builderResponse || null;
    request.respondedAt = new Date();

    const savedRequest = await this.propertyRequestRepository.save(request);

    // Update property status based on response
    if (respondDto.status === PropertyRequestStatus.APPROVED) {
      // Property remains RESERVED, builder should create agreement next
      // Status will change to AGREEMENT_PENDING when agreement is created
    } else {
      // If rejected, check if there are other pending requests
      const pendingRequestsCount = await this.propertyRequestRepository.count({
        where: {
          propertyId: request.propertyId,
          status: PropertyRequestStatus.PENDING,
        },
      });

      // If no other pending requests, set property back to AVAILABLE
      if (pendingRequestsCount === 0) {
        property.status = LandStatus.AVAILABLE;
        await this.landRepository.save(property);
      }
    }

    return PropertyRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * List buyer's property requests
   */
  async findBuyerRequests(
    buyerId: string,
    query: QueryPropertyRequestsDto,
  ): Promise<{
    data: PropertyRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, propertyId } = query;

    const queryBuilder =
      this.propertyRequestRepository.createQueryBuilder('request');

    queryBuilder.where('request.buyerId = :buyerId', { buyerId });

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
        PropertyRequestResponseDto.fromEntity(request),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * List builder's pending requests
   */
  async findBuilderPendingRequests(
    builderId: string,
    query: QueryPropertyRequestsDto,
  ): Promise<{
    data: PropertyRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, propertyId } = query;

    // Get all properties owned by builder
    const builderProperties = await this.landRepository.find({
      where: { ownerId: builderId },
      select: ['id'],
    });

    const propertyIds = builderProperties.map((p) => p.id);

    if (propertyIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    const queryBuilder =
      this.propertyRequestRepository.createQueryBuilder('request');

    queryBuilder.where('request.propertyId IN (:...propertyIds)', {
      propertyIds,
    });

    // Filter by pending status only for builder's view
    queryBuilder.andWhere('request.status = :status', {
      status: PropertyRequestStatus.PENDING,
    });

    if (propertyId) {
      // Additional filter if specific property requested
      if (propertyIds.includes(propertyId)) {
        queryBuilder.andWhere('request.propertyId = :propertyId', {
          propertyId,
        });
      } else {
        // If property doesn't belong to builder, return empty
        return {
          data: [],
          total: 0,
          page,
          limit,
        };
      }
    }

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        PropertyRequestResponseDto.fromEntity(request),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Find all property requests with filters (admin or general query)
   */
  async findAll(
    query: QueryPropertyRequestsDto,
  ): Promise<{
    data: PropertyRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      status,
      propertyId,
      buyerId,
    } = query;

    const queryBuilder =
      this.propertyRequestRepository.createQueryBuilder('request');

    if (status) {
      queryBuilder.where('request.status = :status', { status });
    }

    if (propertyId) {
      queryBuilder.andWhere('request.propertyId = :propertyId', {
        propertyId,
      });
    }

    if (buyerId) {
      queryBuilder.andWhere('request.buyerId = :buyerId', { buyerId });
    }

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        PropertyRequestResponseDto.fromEntity(request),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Find one property request by ID
   */
  async findOne(id: string): Promise<PropertyRequestResponseDto> {
    const request = await this.propertyRequestRepository.findOne({
      where: { id },
      relations: ['property', 'buyer'],
    });

    if (!request) {
      throw new NotFoundException('Property request not found');
    }

    return PropertyRequestResponseDto.fromEntity(request);
  }

  /**
   * Cancel a property request (buyer action)
   */
  async cancelPropertyRequest(
    requestId: string,
    buyerId: string,
  ): Promise<PropertyRequestResponseDto> {
    const request = await this.propertyRequestRepository.findOne({
      where: { id: requestId },
      relations: ['property'],
    });

    if (!request) {
      throw new NotFoundException('Property request not found');
    }

    // Verify buyer owns the request
    if (request.buyerId !== buyerId) {
      throw new ForbiddenException(
        'You are not authorized to cancel this request',
      );
    }

    // Check if request can be cancelled
    if (request.status !== PropertyRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel request with status "${request.status}". Only pending requests can be cancelled.`,
      );
    }

    // Update request status
    request.status = PropertyRequestStatus.CANCELLED;

    const savedRequest = await this.propertyRequestRepository.save(request);

    // Update property status if needed
    const property = await this.landRepository.findOne({
      where: { id: request.propertyId },
    });

    if (property) {
      // Check if there are other pending requests
      const pendingRequestsCount = await this.propertyRequestRepository.count({
        where: {
          propertyId: request.propertyId,
          status: PropertyRequestStatus.PENDING,
        },
      });

      // If no other pending requests, set property back to AVAILABLE
      if (pendingRequestsCount === 0 && property.status === LandStatus.RESERVED) {
        property.status = LandStatus.AVAILABLE;
        await this.landRepository.save(property);
      }
    }

    return PropertyRequestResponseDto.fromEntity(savedRequest);
  }
}

