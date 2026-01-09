import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { Agreement, AgreementStatus } from '../entities/agreement.entity';
import { Land } from '../entities/land.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { CreateInstallmentsDto } from './dto/create-installments.dto';
import { QueryInstallmentsDto } from './dto/query-installments.dto';
import { InstallmentResponseDto } from './dto/installment-response.dto';

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private installmentRepository: Repository<Installment>,
    @InjectRepository(Agreement)
    private agreementRepository: Repository<Agreement>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {}

  /**
   * Create installments from a signed agreement
   * Installments are created with timeline-based payment windows
   */
  async createInstallmentsFromAgreement(
    createDto: CreateInstallmentsDto,
    builderId: string,
  ): Promise<InstallmentResponseDto[]> {
    // Verify agreement exists and is signed
    const agreement = await this.agreementRepository.findOne({
      where: { id: createDto.agreementId },
      relations: ['property', 'buyer', 'builder'],
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    // Verify agreement belongs to builder
    if (agreement.builderId !== builderId) {
      throw new ForbiddenException(
        'You can only create installments for your own agreements',
      );
    }

    // Verify agreement is signed
    if (agreement.status !== AgreementStatus.SIGNED) {
      throw new BadRequestException(
        'Agreement must be signed before creating installments',
      );
    }

    // Check if installments already exist for this agreement
    const existingInstallments = await this.installmentRepository.find({
      where: { agreementId: agreement.id },
    });

    if (existingInstallments.length > 0) {
      throw new BadRequestException(
        'Installments already exist for this agreement',
      );
    }

    const property = agreement.property;
    const totalAmount =
      agreement.terms?.totalAmount || agreement.terms?.price || property.price;
    const planYears =
      agreement.terms?.installmentPlanYears || property.installmentPlanYears;

    if (!planYears || (planYears !== 2 && planYears !== 3 && planYears !== 5)) {
      throw new BadRequestException(
        'Invalid installment plan. Must be 2, 3, or 5 years',
      );
    }

    // Calculate number of installments (default: monthly for the plan years)
    const numberOfInstallments =
      createDto.numberOfInstallments || planYears * 12;

    if (numberOfInstallments < 1) {
      throw new BadRequestException(
        'Number of installments must be at least 1',
      );
    }

    // Calculate installment amount (divide total amount equally)
    const installmentAmount = totalAmount / numberOfInstallments;

    // Calculate timeline
    const startDate = property.installmentStartDate
      ? new Date(property.installmentStartDate)
      : new Date();

    const endDate = property.installmentEndDate
      ? new Date(property.installmentEndDate)
      : (() => {
          const date = new Date(startDate);
          date.setFullYear(date.getFullYear() + planYears);
          return date;
        })();

    // Calculate months between start and end
    const totalMonths =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    const monthsPerInstallment = totalMonths / numberOfInstallments;

    // Create installments with timeline-based windows
    const installments: Installment[] = [];

    for (let i = 0; i < numberOfInstallments; i++) {
      // Calculate payment window for this installment
      const windowStart = new Date(startDate);
      windowStart.setMonth(
        windowStart.getMonth() + Math.floor(i * monthsPerInstallment),
      );

      const windowEnd = new Date(windowStart);
      windowEnd.setMonth(
        windowEnd.getMonth() + Math.ceil(monthsPerInstallment),
      );

      // Last installment window should end at the agreement end date
      if (i === numberOfInstallments - 1) {
        windowEnd.setTime(endDate.getTime());
      }

      const installment = this.installmentRepository.create({
        landId: property.id,
        agreementId: agreement.id,
        buyerId: agreement.buyerId,
        amount:
          i === numberOfInstallments - 1
            ? totalAmount - installmentAmount * (numberOfInstallments - 1) // Last installment gets remainder
            : installmentAmount,
        paymentWindowStart: windowStart,
        paymentWindowEnd: windowEnd,
        status: InstallmentStatus.PENDING,
      });

      installments.push(installment);
    }

    const savedInstallments =
      await this.installmentRepository.save(installments);

    return savedInstallments.map((installment) =>
      InstallmentResponseDto.fromEntity(installment),
    );
  }

  /**
   * Update overdue installments based on timeline expiry
   * Should be called periodically (e.g., via cron job)
   */
  async updateOverdueInstallments(): Promise<number> {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    const overdueInstallments = await this.installmentRepository.find({
      where: {
        status: InstallmentStatus.PENDING,
        paymentWindowEnd: LessThan(now),
      },
    });

    let updatedCount = 0;
    for (const installment of overdueInstallments) {
      installment.status = InstallmentStatus.OVERDUE;
      await this.installmentRepository.save(installment);
      updatedCount++;
    }

    return updatedCount;
  }

  /**
   * Find all installments with filters
   */
  async findAll(query: QueryInstallmentsDto): Promise<{
    data: InstallmentResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      status,
      propertyId,
      agreementId,
      buyerId,
    } = query;

    const queryBuilder =
      this.installmentRepository.createQueryBuilder('installment');

    if (status) {
      queryBuilder.where('installment.status = :status', { status });
    }

    if (propertyId) {
      queryBuilder.andWhere('installment.landId = :propertyId', {
        propertyId,
      });
    }

    if (agreementId) {
      queryBuilder.andWhere('installment.agreementId = :agreementId', {
        agreementId,
      });
    }

    if (buyerId) {
      queryBuilder.andWhere('installment.buyerId = :buyerId', { buyerId });
    }

    const [installments, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('installment.paymentWindowStart', 'ASC')
      .getManyAndCount();

    return {
      data: installments.map((installment) =>
        InstallmentResponseDto.fromEntity(installment),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Find installments for a buyer
   */
  async findBuyerInstallments(
    buyerId: string,
    query: QueryInstallmentsDto,
  ): Promise<{
    data: InstallmentResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const updatedQuery = { ...query, buyerId };
    return this.findAll(updatedQuery);
  }

  /**
   * Find one installment by ID
   */
  async findOne(id: string): Promise<InstallmentResponseDto> {
    const installment = await this.installmentRepository.findOne({
      where: { id },
      relations: ['land', 'buyer', 'agreement'],
    });

    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    return InstallmentResponseDto.fromEntity(installment);
  }

  /**
   * Get installment payment status
   * Checks if installment has been paid and updates status accordingly
   */
  async getInstallmentStatus(id: string): Promise<{
    installment: InstallmentResponseDto;
    isPaid: boolean;
    hasPendingPayment: boolean;
    paymentStatus: string;
  }> {
    const installment = await this.installmentRepository.findOne({
      where: { id },
      relations: ['land', 'buyer', 'agreement'],
    });

    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    // Check for verified payments linked to this installment
    const verifiedPayment = await this.paymentRepository.findOne({
      where: {
        installmentId: id,
        status: PaymentStatus.VERIFIED,
      },
    });

    const pendingPayment = await this.paymentRepository.findOne({
      where: {
        installmentId: id,
        status: PaymentStatus.PENDING,
      },
    });

    const isPaid = !!verifiedPayment;
    const hasPendingPayment = !!pendingPayment;

    // Update installment status based on payment and timeline
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (isPaid && installment.status !== InstallmentStatus.PAID) {
      installment.status = InstallmentStatus.PAID;
      if (verifiedPayment) {
        installment.paymentDate = verifiedPayment.createdAt;
      }
      await this.installmentRepository.save(installment);
    } else if (
      !isPaid &&
      installment.paymentWindowEnd < now &&
      installment.status === InstallmentStatus.PENDING
    ) {
      installment.status = InstallmentStatus.OVERDUE;
      await this.installmentRepository.save(installment);
    }

    const updatedInstallment = await this.installmentRepository.findOne({
      where: { id },
    });

    return {
      installment: InstallmentResponseDto.fromEntity(updatedInstallment!),
      isPaid,
      hasPendingPayment,
      paymentStatus: isPaid
        ? 'paid'
        : hasPendingPayment
          ? 'pending_verification'
          : installment.status === InstallmentStatus.OVERDUE
            ? 'overdue'
            : 'pending',
    };
  }
}
