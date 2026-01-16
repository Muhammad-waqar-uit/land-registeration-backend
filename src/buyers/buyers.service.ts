import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { Agreement, AgreementStatus } from '../entities/agreement.entity';
import { PropertyRequest, PropertyRequestStatus } from '../entities/property-request.entity';
import { User, UserRole } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { QueryBuyerProgressDto, BuyerProgressStatus } from './dto/query-buyer-progress.dto';
import {
  BuyerProgressResponseDto,
  BuyerProgressItemDto,
  BuyerProgressStatsDto,
} from './dto/buyer-progress-response.dto';

@Injectable()
export class BuyersService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(Agreement)
    private agreementRepository: Repository<Agreement>,
    @InjectRepository(PropertyRequest)
    private propertyRequestRepository: Repository<PropertyRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
  ) {}

  /**
   * Get buyer progress tracking for builder/seller's properties
   */
  async getBuyerProgress(
    builderId: string,
    query: QueryBuyerProgressDto,
  ): Promise<BuyerProgressResponseDto> {
    // Verify user is builder
    const builder = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (!builder || (builder.role !== UserRole.BUILDER && builder.role !== UserRole.ADMIN)) {
      throw new ForbiddenException(
        'Only builders and sellers can access buyer progress',
      );
    }

    // Get all properties owned by builder OR originally owned by builder (completed sales)
    // This includes:
    // 1. Properties currently owned by builder (ownerId = builderId)
    // 2. Properties originally owned by builder but now owned by buyer (originalOwnerId = builderId, status = OWNED)
    const builderPropertiesQuery = this.landRepository
      .createQueryBuilder('land')
      .where('(land.ownerId = :builderId OR (land.originalOwnerId = :builderId AND land.status = :ownedStatus))', {
        builderId,
        ownedStatus: LandStatus.OWNED,
      });

    // Apply project filter if provided
    if (query.projectId) {
      builderPropertiesQuery.andWhere('land.projectId = :projectId', {
        projectId: query.projectId,
      });
    }

    const builderProperties = await builderPropertiesQuery
      .select(['land.id', 'land.projectId', 'land.ownerId', 'land.originalOwnerId', 'land.status'])
      .getMany();

    const propertyIds = builderProperties.map((p) => p.id);

    if (propertyIds.length === 0) {
      return {
        data: [],
        total: 0,
        stats: {
          totalBuyers: 0,
          reserved: 0,
          inProgress: 0,
          completed: 0,
          totalRevenue: 0,
          pendingRevenue: 0,
          byStatus: {
            reserved: { count: 0, revenue: 0 },
            paying: { count: 0, revenue: 0 },
            completed: { count: 0, revenue: 0 },
          },
          byProject: {},
        },
      };
    }

    // Get all payments for builder's properties with relations
    // Include payments for properties originally owned by builder (even if now owned by buyer)
    const paymentsQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.land', 'land')
      .innerJoin('payment.buyer', 'buyer')
      .leftJoin('payment.agreement', 'agreement')
      .leftJoin('land.project', 'project')
      .where('(land.ownerId = :builderId OR land.originalOwnerId = :builderId)', { builderId })
      .andWhere('land.id IN (:...propertyIds)', { propertyIds })
      .leftJoinAndSelect('payment.land', 'landData')
      .leftJoinAndSelect('payment.buyer', 'buyerData')
      .leftJoinAndSelect('landData.project', 'projectData');

    // Apply filters
    if (query.landId && propertyIds.includes(query.landId)) {
      paymentsQuery.andWhere('land.id = :landId', { landId: query.landId });
    }

    if (query.buyerId) {
      paymentsQuery.andWhere('buyer.id = :buyerId', { buyerId: query.buyerId });
    }

    const payments = await paymentsQuery.getMany();

    // Also get property requests for reserved status (no payments yet)
    // Include requests for properties originally owned by builder
    const propertyRequestsQuery = this.propertyRequestRepository
      .createQueryBuilder('request')
      .innerJoin('request.property', 'property')
      .innerJoin('request.buyer', 'buyer')
      .leftJoin('property.project', 'project')
      .where('(property.ownerId = :builderId OR property.originalOwnerId = :builderId)', { builderId })
      .andWhere('property.id IN (:...propertyIds)', { propertyIds })
      .andWhere('request.status = :status', {
        status: PropertyRequestStatus.PENDING,
      })
      .leftJoinAndSelect('request.property', 'propertyData')
      .leftJoinAndSelect('request.buyer', 'buyerData')
      .leftJoinAndSelect('propertyData.project', 'projectData');

    if (query.landId && propertyIds.includes(query.landId)) {
      propertyRequestsQuery.andWhere('property.id = :landId', {
        landId: query.landId,
      });
    }

    if (query.buyerId) {
      propertyRequestsQuery.andWhere('buyer.id = :buyerId', {
        buyerId: query.buyerId,
      });
    }

    const propertyRequests = await propertyRequestsQuery.getMany();

    // Group payments by (buyerId, landId)
    const progressMap = new Map<string, BuyerProgressItemDto>();

    // Process payments
    for (const payment of payments) {
      const key = `${payment.buyerId}_${payment.landId}`;

      if (!progressMap.has(key)) {
        // Get agreement for this buyer-property combination
        const agreement = await this.agreementRepository.findOne({
          where: {
            propertyId: payment.landId,
            buyerId: payment.buyerId,
          },
          order: { createdAt: 'DESC' },
        });

        // Get property request for reservation date
        const propertyRequest = await this.propertyRequestRepository.findOne({
          where: {
            propertyId: payment.landId,
            buyerId: payment.buyerId,
          },
          order: { createdAt: 'ASC' },
        });

        const land = payment.land;
        const buyer = payment.buyer;

        if (!land || !buyer) {
          continue; // Skip if relations not loaded
        }

        // Determine initial status
        let initialStatus: 'reserved' | 'paying' | 'completed' = 'reserved';
        if (agreement?.status === AgreementStatus.SIGNED) {
          initialStatus = 'paying';
        }

        progressMap.set(key, {
          buyerId: payment.buyerId,
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          buyerPhone: buyer.phoneNumber,
          landId: payment.landId,
          landTitle: land.title,
          landLocation: land.location,
          landPrice: parseFloat(land.price.toString()),
          projectId: land.projectId || null,
          projectName: land.project?.name || null,
          totalPaid: 0,
          remainingBalance: parseFloat(land.price.toString()),
          pendingPayments: 0,
          verifiedPayments: 0,
          lastPaymentDate: null,
          lastPaymentAmount: null,
          status: initialStatus,
          agreementId: agreement?.id || null,
          agreementStatus: agreement?.status || null,
          reservationDate: propertyRequest?.createdAt || null,
          createdAt: propertyRequest?.createdAt || payment.createdAt,
          updatedAt: payment.createdAt,
        });
      }

      const progress = progressMap.get(key)!;

      if (payment.status === PaymentStatus.VERIFIED) {
        progress.totalPaid += parseFloat(payment.amount.toString());
        progress.verifiedPayments += 1;

        // Update last payment info
        if (!progress.lastPaymentDate || payment.createdAt > progress.lastPaymentDate) {
          progress.lastPaymentDate = payment.createdAt;
          progress.lastPaymentAmount = parseFloat(payment.amount.toString());
        }
      } else if (payment.status === PaymentStatus.PENDING) {
        progress.pendingPayments += 1;
      }

      // Update remaining balance
      progress.remainingBalance = progress.landPrice - progress.totalPaid;

      // Update status based on payments, agreement, and property status
      // Check if property is OWNED (ownership transferred) - this means completed
      const currentProperty = payment.land;
      if (currentProperty.status === LandStatus.OWNED && currentProperty.ownerId !== builderId) {
        // Property is owned by buyer - ownership transferred, so it's completed
        progress.status = 'completed';
        progress.remainingBalance = 0;
      } else if (progress.remainingBalance <= 0) {
        progress.status = 'completed';
        progress.remainingBalance = 0;
      } else if (progress.totalPaid > 0 || progress.pendingPayments > 0) {
        progress.status = 'paying';
      } else if (progress.agreementStatus === AgreementStatus.SIGNED) {
        // Agreement signed but no payments yet - still considered "paying"
        progress.status = 'paying';
      } else {
        progress.status = 'reserved';
      }

      // Update updatedAt
      if (payment.createdAt > progress.updatedAt) {
        progress.updatedAt = payment.createdAt;
      }
    }

    // Process property requests (for reserved status - no payments yet)
    for (const request of propertyRequests) {
      const key = `${request.buyerId}_${request.propertyId}`;

      // Only add if no payments exist for this buyer-property
      if (!progressMap.has(key)) {
        const property = request.property;
        const buyer = request.buyer;

        if (!property || !buyer) {
          continue; // Skip if relations not loaded
        }

        // Check if there's a signed agreement
        const agreement = await this.agreementRepository.findOne({
          where: {
            propertyId: request.propertyId,
            buyerId: request.buyerId,
          },
          order: { createdAt: 'DESC' },
        });

        // Determine status: if agreement is signed, status is "paying", otherwise "reserved"
        let status: 'reserved' | 'paying' | 'completed' = 'reserved';
        if (agreement?.status === AgreementStatus.SIGNED) {
          status = 'paying';
        }

        progressMap.set(key, {
          buyerId: request.buyerId,
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          buyerPhone: buyer.phoneNumber,
          landId: request.propertyId,
          landTitle: property.title,
          landLocation: property.location,
          landPrice: parseFloat(property.price.toString()),
          projectId: property.projectId || null,
          projectName: property.project?.name || null,
          totalPaid: 0,
          remainingBalance: parseFloat(property.price.toString()),
          pendingPayments: 0,
          verifiedPayments: 0,
          lastPaymentDate: null,
          lastPaymentAmount: null,
          status,
          agreementId: agreement?.id || null,
          agreementStatus: agreement?.status || null,
          reservationDate: request.createdAt,
          createdAt: request.createdAt,
          updatedAt: request.createdAt,
        });
      }
    }

    // Also get agreements that are signed but have no payments yet
    // Also get COMPLETED agreements for owned properties
    const agreementsQuery = this.agreementRepository
      .createQueryBuilder('agreement')
      .innerJoin('agreement.property', 'property')
      .innerJoin('agreement.buyer', 'buyer')
      .leftJoin('property.project', 'project')
      .where('(property.ownerId = :builderId OR property.originalOwnerId = :builderId)', { builderId })
      .andWhere('property.id IN (:...propertyIds)', { propertyIds })
      .andWhere('(agreement.status = :signedStatus OR agreement.status = :completedStatus)', {
        signedStatus: AgreementStatus.SIGNED,
        completedStatus: AgreementStatus.COMPLETED,
      })
      .leftJoinAndSelect('agreement.property', 'propertyData')
      .leftJoinAndSelect('agreement.buyer', 'buyerData')
      .leftJoinAndSelect('propertyData.project', 'projectData');

    if (query.landId && propertyIds.includes(query.landId)) {
      agreementsQuery.andWhere('property.id = :landId', {
        landId: query.landId,
      });
    }

    if (query.buyerId) {
      agreementsQuery.andWhere('buyer.id = :buyerId', {
        buyerId: query.buyerId,
      });
    }

    const agreements = await agreementsQuery.getMany();

    // Add agreements that have no payments (or completed agreements)
    for (const agreement of agreements) {
      const key = `${agreement.buyerId}_${agreement.propertyId}`;

      const property = agreement.property;
      const buyer = agreement.buyer;

      if (!property || !buyer) {
        continue;
      }

      // Get property request for reservation date
      const propertyRequest = await this.propertyRequestRepository.findOne({
        where: {
          propertyId: agreement.propertyId,
          buyerId: agreement.buyerId,
        },
        order: { createdAt: 'ASC' },
      });

      // If agreement is COMPLETED, check if property is OWNED and calculate final payment status
      if (agreement.status === AgreementStatus.COMPLETED) {
        // For completed agreements, property should be fully paid
        const allPayments = await this.paymentRepository.find({
          where: {
            landId: agreement.propertyId,
            buyerId: agreement.buyerId,
            status: PaymentStatus.VERIFIED,
          },
        });

        const totalPaid = allPayments.reduce(
          (sum, p) => sum + parseFloat(p.amount.toString()),
          0,
        );

        progressMap.set(key, {
          buyerId: agreement.buyerId,
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          buyerPhone: buyer.phoneNumber,
          landId: agreement.propertyId,
          landTitle: property.title,
          landLocation: property.location,
          landPrice: parseFloat(property.price.toString()),
          projectId: property.projectId || null,
          projectName: property.project?.name || null,
          totalPaid,
          remainingBalance: 0, // Completed means fully paid
          pendingPayments: 0,
          verifiedPayments: allPayments.length,
          lastPaymentDate: allPayments.length > 0
            ? allPayments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
            : null,
          lastPaymentAmount: allPayments.length > 0
            ? parseFloat(allPayments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].amount.toString())
            : null,
          status: 'completed', // Completed agreement means ownership transferred
          agreementId: agreement.id,
          agreementStatus: agreement.status,
          reservationDate: propertyRequest?.createdAt || agreement.createdAt,
          createdAt: propertyRequest?.createdAt || agreement.createdAt,
          updatedAt: agreement.updatedAt,
        });
      } else if (!progressMap.has(key)) {
        // Only add signed agreements if no payments exist for this buyer-property
        progressMap.set(key, {
          buyerId: agreement.buyerId,
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          buyerPhone: buyer.phoneNumber,
          landId: agreement.propertyId,
          landTitle: property.title,
          landLocation: property.location,
          landPrice: parseFloat(property.price.toString()),
          projectId: property.projectId || null,
          projectName: property.project?.name || null,
          totalPaid: 0,
          remainingBalance: parseFloat(property.price.toString()),
          pendingPayments: 0,
          verifiedPayments: 0,
          lastPaymentDate: null,
          lastPaymentAmount: null,
          status: 'paying', // Signed agreement means buyer is in paying phase
          agreementId: agreement.id,
          agreementStatus: agreement.status,
          reservationDate: propertyRequest?.createdAt || agreement.createdAt,
          createdAt: propertyRequest?.createdAt || agreement.createdAt,
          updatedAt: agreement.updatedAt,
        });
      }
    }

    // Convert map to array (before filtering for stats calculation)
    const allProgressItems = Array.from(progressMap.values());

    // Apply status filter
    let progressItems = allProgressItems;
    if (query.status) {
      progressItems = progressItems.filter((item) => item.status === query.status);
    }

    // Calculate per-status statistics (from all items, not filtered)
    const byStatus = {
      reserved: {
        count: allProgressItems.filter((item) => item.status === 'reserved').length,
        revenue: allProgressItems
          .filter((item) => item.status === 'reserved')
          .reduce((sum, item) => sum + item.totalPaid, 0),
      },
      paying: {
        count: allProgressItems.filter((item) => item.status === 'paying').length,
        revenue: allProgressItems
          .filter((item) => item.status === 'paying')
          .reduce((sum, item) => sum + item.totalPaid, 0),
      },
      completed: {
        count: allProgressItems.filter((item) => item.status === 'completed').length,
        revenue: allProgressItems
          .filter((item) => item.status === 'completed')
          .reduce((sum, item) => sum + item.totalPaid, 0),
      },
    };

    // Calculate per-project statistics (from all items, not filtered)
    const byProjectMap = new Map<
      string,
      {
        projectName: string;
        totalBuyers: number;
        reserved: number;
        inProgress: number;
        completed: number;
        totalRevenue: number;
        pendingRevenue: number;
      }
    >();

    for (const item of allProgressItems) {
      if (!item.projectId) continue; // Skip items without projects

      if (!byProjectMap.has(item.projectId)) {
        byProjectMap.set(item.projectId, {
          projectName: item.projectName || 'Unknown Project',
          totalBuyers: 0,
          reserved: 0,
          inProgress: 0,
          completed: 0,
          totalRevenue: 0,
          pendingRevenue: 0,
        });
      }

      const projectStats = byProjectMap.get(item.projectId)!;
      projectStats.totalBuyers += 1;

      if (item.status === 'reserved') {
        projectStats.reserved += 1;
      } else if (item.status === 'paying') {
        projectStats.inProgress += 1;
      } else if (item.status === 'completed') {
        projectStats.completed += 1;
      }

      projectStats.totalRevenue += item.totalPaid;
      projectStats.pendingRevenue += item.remainingBalance;
    }

    const byProject: Record<
      string,
      {
        projectName: string;
        totalBuyers: number;
        reserved: number;
        inProgress: number;
        completed: number;
        totalRevenue: number;
        pendingRevenue: number;
      }
    > = {};

    for (const [projectId, stats] of byProjectMap.entries()) {
      byProject[projectId] = stats;
    }

    // Calculate overall statistics (use allProgressItems for overall stats, progressItems for filtered count)
    const stats: BuyerProgressStatsDto = {
      totalBuyers: progressItems.length, // Filtered count
      reserved: allProgressItems.filter((item) => item.status === 'reserved').length,
      inProgress: allProgressItems.filter((item) => item.status === 'paying').length,
      completed: allProgressItems.filter((item) => item.status === 'completed').length,
      totalRevenue: allProgressItems.reduce((sum, item) => sum + item.totalPaid, 0),
      pendingRevenue: allProgressItems.reduce(
        (sum, item) => sum + item.remainingBalance,
        0,
      ),
      byStatus,
      byProject,
    };

    // Sort by last payment date (most recent first), then by created date
    progressItems.sort((a, b) => {
      if (a.lastPaymentDate && b.lastPaymentDate) {
        return b.lastPaymentDate.getTime() - a.lastPaymentDate.getTime();
      }
      if (a.lastPaymentDate) return -1;
      if (b.lastPaymentDate) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return {
      data: progressItems,
      total: progressItems.length,
      stats,
    };
  }
}
