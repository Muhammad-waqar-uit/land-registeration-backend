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
import { User } from '../entities/user.entity';
import { Agreement } from '../entities/agreement.entity';
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
    @InjectRepository(Agreement)
    private agreementRepository: Repository<Agreement>,
    private landsService: LandsService,
  ) {}

  /**
   * Helper method to get agreement ID for a property request
   */
  private async getAgreementIdForRequest(
    propertyId: string,
    buyerId: string,
  ): Promise<string | null> {
    const agreement = await this.agreementRepository.findOne({
      where: {
        propertyId,
        buyerId,
      },
      select: ['id'],
      order: { createdAt: 'DESC' }, // Get the most recent agreement
    });

    return agreement?.id || null;
  }

  /**
   * Helper method to add agreement IDs to property requests
   */
  private async addAgreementIdsToRequests(
    requests: PropertyRequest[],
  ): Promise<(PropertyRequest & { agreementId: string | null })[]> {
    return Promise.all(
      requests.map(async (request) => {
        const agreementId = await this.getAgreementIdForRequest(
          request.propertyId,
          request.buyerId,
        );
        return {
          ...request,
          agreementId,
        };
      }),
    );
  }

  /**
   * Step 5.2 Flow Step 1: Create purchase request (buyer action)
   *
   * Buyer initiates purchase request for an available property.
   * Property status changes to RESERVED to prevent other buyers from requesting.
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

    const savedRequest =
      await this.propertyRequestRepository.save(propertyRequest);

    // Update property status to RESERVED
    const property = eligibility.property;
    if (property && property.status === LandStatus.AVAILABLE) {
      property.status = LandStatus.RESERVED;
      await this.landRepository.save(property);
    }

    return PropertyRequestResponseDto.fromEntity(savedRequest);
  }

  /**
   * Step 5.2 Flow Steps 2-3: Builder approval/rejection of property request
   *
   * Flow:
   * 1. Buyer creates request (Step 1 - handled by createPropertyRequest)
   * 2. Builder reviews request (Step 2 - builder views pending requests)
   * 3. Builder approves/rejects (Step 3 - this method)
   * 4. If approved → Property status changes to AGREEMENT_PENDING
   *    → Builder should create agreement next (separate endpoint)
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

    // Step 5.2: Update property status based on response
    if (respondDto.status === PropertyRequestStatus.APPROVED) {
      // Step 5.2 Flow Step 3: Builder approved request
      // Next step: Builder should create an initial agreement for this buyer
      // Property status changes to AGREEMENT_PENDING to indicate ready for agreement creation
      property.status = LandStatus.AGREEMENT_PENDING;
      await this.landRepository.save(property);

      // Step 5.2 Flow Step 4: If approved → Create agreement
      // Note: Agreement creation is initiated separately by the builder
      // The builder can now create an agreement using the agreements endpoint
      // with propertyId and buyerId from this approved request
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

    // Load relations: buyer and property
    queryBuilder
      .leftJoinAndSelect('request.buyer', 'buyer')
      .leftJoinAndSelect('request.property', 'property');

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

    // Get agreement IDs for each request
    const requestsWithAgreements =
      await this.addAgreementIdsToRequests(requests);

    return {
      data: requestsWithAgreements.map((request) =>
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

    // Load relations: buyer and property
    queryBuilder
      .leftJoinAndSelect('request.buyer', 'buyer')
      .leftJoinAndSelect('request.property', 'property');

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
   * Get all property requests for builder's properties (all statuses)
   */
  async findBuilderRequests(
    builderId: string,
    query: QueryPropertyRequestsDto,
  ): Promise<{
    data: PropertyRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, propertyId, status } = query;

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

    // Load relations: buyer and property
    queryBuilder
      .leftJoinAndSelect('request.buyer', 'buyer')
      .leftJoinAndSelect('request.property', 'property');

    queryBuilder.where('request.propertyId IN (:...propertyIds)', {
      propertyIds,
    });

    // Optional status filter
    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

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

    // Get agreement IDs for each request
    const requestsWithAgreements =
      await this.addAgreementIdsToRequests(requests);

    return {
      data: requestsWithAgreements.map((request) =>
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
  async findAll(query: QueryPropertyRequestsDto): Promise<{
    data: PropertyRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, propertyId, buyerId } = query;

    const queryBuilder =
      this.propertyRequestRepository.createQueryBuilder('request');

    // Load relations: buyer and property
    queryBuilder
      .leftJoinAndSelect('request.buyer', 'buyer')
      .leftJoinAndSelect('request.property', 'property');

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

    // Get agreement IDs for each request
    const requestsWithAgreements =
      await this.addAgreementIdsToRequests(requests);

    return {
      data: requestsWithAgreements.map((request) =>
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

    // Get agreement ID for this request
    const agreementId = await this.getAgreementIdForRequest(
      request.propertyId,
      request.buyerId,
    );

    return PropertyRequestResponseDto.fromEntity({
      ...request,
      agreementId,
    });
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
      if (
        pendingRequestsCount === 0 &&
        property.status === LandStatus.RESERVED
      ) {
        property.status = LandStatus.AVAILABLE;
        await this.landRepository.save(property);
      }
    }

    return PropertyRequestResponseDto.fromEntity(savedRequest);
  }
}
