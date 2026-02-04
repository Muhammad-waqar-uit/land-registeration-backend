import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TokenRequest,
  TokenRequestStatus,
} from '../entities/token-request.entity';
import { User } from '../entities/user.entity';
import { CreateTokenRequestDto } from './dto/create-token-request.dto';
import { RespondTokenRequestDto } from './dto/respond-token-request.dto';
import { QueryTokenRequestsDto } from './dto/query-token-requests.dto';
import { TokenRequestResponseDto } from './dto/token-request-response.dto';

@Injectable()
export class TokenRequestsService {
  constructor(
    @InjectRepository(TokenRequest)
    private tokenRequestRepository: Repository<TokenRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Create a new token request (User: buyer/seller/builder)
   */
  async createTokenRequest(
    createDto: CreateTokenRequestDto,
    userId: string,
  ): Promise<TokenRequestResponseDto> {
    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create token request
    const tokenRequest = this.tokenRequestRepository.create({
      userId: userId,
      amount: createDto.amount,
      notes: createDto.notes || null,
      screenshotUrl: createDto.screenshotUrl || null,
      status: TokenRequestStatus.PENDING,
    });

    const savedRequest = await this.tokenRequestRepository.save(tokenRequest);

    // Load user relation for response
    const requestWithUser = await this.tokenRequestRepository.findOne({
      where: { id: savedRequest.id },
      relations: ['user'],
    });

    if (!requestWithUser) {
      throw new NotFoundException('Token request not found after creation');
    }

    return TokenRequestResponseDto.fromEntity(requestWithUser);
  }

  /**
   * Admin responds to token request (approve/reject)
   */
  async respondToTokenRequest(
    requestId: string,
    respondDto: RespondTokenRequestDto,
    adminId: string,
  ): Promise<TokenRequestResponseDto> {
    const request = await this.tokenRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new NotFoundException('Token request not found');
    }

    // Verify admin exists and is admin
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    // Check if request can be responded to
    if (request.status !== TokenRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot respond to request with status "${request.status}". Only pending requests can be responded to.`,
      );
    }

    // Validate status
    if (
      respondDto.status !== TokenRequestStatus.APPROVED &&
      respondDto.status !== TokenRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Response status must be either APPROVED or REJECTED',
      );
    }

    // Update request
    request.status = respondDto.status;
    request.adminResponse = respondDto.adminResponse || null;
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();

    const savedRequest = await this.tokenRequestRepository.save(request);

    // Load reviewer relation for response
    const requestWithRelations = await this.tokenRequestRepository.findOne({
      where: { id: savedRequest.id },
      relations: ['user', 'reviewer'],
    });

    if (!requestWithRelations) {
      throw new NotFoundException('Token request not found after update');
    }

    // TODO: If approved, you may want to trigger blockchain token transfer here
    // This would integrate with your TokensService to actually mint/transfer tokens

    return TokenRequestResponseDto.fromEntity(requestWithRelations);
  }

  /**
   * Get user's own token requests
   */
  async findUserRequests(
    userId: string,
    query: QueryTokenRequestsDto,
  ): Promise<{
    data: TokenRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status } = query;

    const queryBuilder =
      this.tokenRequestRepository.createQueryBuilder('request');

    queryBuilder
      .leftJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.reviewer', 'reviewer');

    queryBuilder.where('request.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        TokenRequestResponseDto.fromEntity(request),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Get all token requests (Admin only)
   */
  async findAll(query: QueryTokenRequestsDto): Promise<{
    data: TokenRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, userId } = query;

    const queryBuilder =
      this.tokenRequestRepository.createQueryBuilder('request');

    queryBuilder
      .leftJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.reviewer', 'reviewer');

    if (status) {
      queryBuilder.where('request.status = :status', { status });
    }

    if (userId) {
      queryBuilder.andWhere('request.userId = :userId', { userId });
    }

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        TokenRequestResponseDto.fromEntity(request),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Get pending token requests (Admin only)
   */
  async findPendingRequests(query: QueryTokenRequestsDto): Promise<{
    data: TokenRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10 } = query;

    const queryBuilder =
      this.tokenRequestRepository.createQueryBuilder('request');

    queryBuilder
      .leftJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.reviewer', 'reviewer');

    queryBuilder.where('request.status = :status', {
      status: TokenRequestStatus.PENDING,
    });

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('request.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: requests.map((request) =>
        TokenRequestResponseDto.fromEntity(request),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single token request by ID
   */
  async findOne(id: string): Promise<TokenRequestResponseDto> {
    const request = await this.tokenRequestRepository.findOne({
      where: { id },
      relations: ['user', 'reviewer'],
    });

    if (!request) {
      throw new NotFoundException('Token request not found');
    }

    return TokenRequestResponseDto.fromEntity(request);
  }

  /**
   * Get request statistics (Admin only)
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    totalAmountRequested: number;
    totalAmountApproved: number;
  }> {
    const [total, pending, approved, rejected] = await Promise.all([
      this.tokenRequestRepository.count(),
      this.tokenRequestRepository.count({
        where: { status: TokenRequestStatus.PENDING },
      }),
      this.tokenRequestRepository.count({
        where: { status: TokenRequestStatus.APPROVED },
      }),
      this.tokenRequestRepository.count({
        where: { status: TokenRequestStatus.REJECTED },
      }),
    ]);

    // Calculate total amounts
    const allRequests = await this.tokenRequestRepository.find({
      select: ['amount', 'status'],
    });

    const totalAmountRequested = allRequests.reduce(
      (sum, req) => sum + Number(req.amount),
      0,
    );

    const totalAmountApproved = allRequests
      .filter((req) => req.status === TokenRequestStatus.APPROVED)
      .reduce((sum, req) => sum + Number(req.amount), 0);

    return {
      total,
      pending,
      approved,
      rejected,
      totalAmountRequested,
      totalAmountApproved,
    };
  }

  /**
   * Cancel a pending token request (User action)
   */
  async cancelTokenRequest(
    requestId: string,
    userId: string,
  ): Promise<TokenRequestResponseDto> {
    const request = await this.tokenRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new NotFoundException('Token request not found');
    }

    // Verify user owns the request
    if (request.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to cancel this request',
      );
    }

    // Check if request can be cancelled
    if (request.status !== TokenRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel request with status "${request.status}". Only pending requests can be cancelled.`,
      );
    }

    // Delete the request instead of updating status
    await this.tokenRequestRepository.remove(request);

    return TokenRequestResponseDto.fromEntity(request);
  }
}
