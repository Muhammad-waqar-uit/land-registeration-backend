import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payment,
  PaymentStatus,
  PaymentMode,
} from '../entities/payment.entity';
import {
  Land,
  LandStatus,
  AgreementStatus as LandAgreementStatus,
} from '../entities/land.entity';
import { Agreement, AgreementStatus } from '../entities/agreement.entity';
import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { InstallmentSummaryResponseDto } from './dto/installment-summary-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';
import { BlockchainService } from '../common/services/blockchain.service';
import { IpfsService } from '../common/services/ipfs.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(Agreement)
    private agreementRepository: Repository<Agreement>,
    @InjectRepository(Installment)
    private installmentRepository: Repository<Installment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private fileStorageService: FileStorageService,
    private blockchainService: BlockchainService,
    private ipfsService: IpfsService,
  ) {}

  async create(
    createPaymentDto: CreatePaymentDto,
    file: Express.Multer.File | undefined,
    buyerId: string,
  ): Promise<PaymentResponseDto> {
    // Verify land/property exists
    const land = await this.landRepository.findOne({
      where: { id: createPaymentDto.landId },
      relations: ['owner'],
    });

    if (!land) {
      throw new NotFoundException('Property not found');
    }

    // Verify agreement if provided
    let agreement: Agreement | null = null;
    if (createPaymentDto.agreementId) {
      agreement = await this.agreementRepository.findOne({
        where: { id: createPaymentDto.agreementId },
        relations: ['property', 'buyer', 'builder'],
      });

      if (!agreement) {
        throw new NotFoundException('Agreement not found');
      }

      // Verify agreement belongs to this property and buyer
      if (agreement.propertyId !== createPaymentDto.landId) {
        throw new BadRequestException(
          'Agreement does not belong to this property',
        );
      }

      if (agreement.buyerId !== buyerId) {
        throw new ForbiddenException('Agreement does not belong to this buyer');
      }

      // Verify agreement is signed
      if (agreement.status !== AgreementStatus.SIGNED) {
        throw new BadRequestException(
          'Agreement must be signed before making payments',
        );
      }
    }

    // Verify installment if provided and validate payment window
    let installment: Installment | null = null;
    if (createPaymentDto.installmentId) {
      installment = await this.installmentRepository.findOne({
        where: { id: createPaymentDto.installmentId },
        relations: ['land', 'buyer', 'agreement'],
      });

      if (!installment) {
        throw new NotFoundException('Installment not found');
      }

      // Verify installment belongs to this property and buyer
      if (installment.landId !== createPaymentDto.landId) {
        throw new BadRequestException(
          'Installment does not belong to this property',
        );
      }

      if (installment.buyerId !== buyerId) {
        throw new ForbiddenException(
          'Installment does not belong to this buyer',
        );
      }

      // Validate payment window
      const now = new Date();
      const paymentDate = now;

      if (paymentDate < installment.paymentWindowStart) {
        throw new BadRequestException(
          `Payment is too early. Payment window starts on ${installment.paymentWindowStart.toLocaleDateString()}`,
        );
      }

      if (paymentDate > installment.paymentWindowEnd) {
        throw new BadRequestException(
          `Payment is overdue. Payment window ended on ${installment.paymentWindowEnd.toLocaleDateString()}`,
        );
      }

      // Check if installment is already paid
      if (installment.status === InstallmentStatus.PAID) {
        throw new BadRequestException('This installment has already been paid');
      }
    }

    // Get next payment sequence number
    const existingPayments = await this.paymentRepository.find({
      where: {
        landId: createPaymentDto.landId,
        buyerId: buyerId,
      },
      order: { createdAt: 'ASC' },
    });
    const paymentSequenceNumber = existingPayments.length + 1;

    // Validate payment amount doesn't exceed remaining balance
    // Use computed balance (resale: only payments after resaleListedAt) so we don't use stale land.remainingBalance
    const balanceInfo = await this.calculateRemainingBalance(
      createPaymentDto.landId,
    );
    const remainingBalance = balanceInfo.remainingBalance;
    if (createPaymentDto.amount > remainingBalance) {
      throw new BadRequestException(
        `Payment amount (${createPaymentDto.amount}) exceeds remaining balance (${remainingBalance.toFixed(2)})`,
      );
    }

    let proofCID: string | undefined;
    let proofIPFSHash: string | undefined;
    let transactionHash: string | undefined;
    let initialStatus = PaymentStatus.PENDING;

    // POINTS: deduct from buyer's ledger balance and transfer to builder (auto-verified)
    if (createPaymentDto.paymentMode === PaymentMode.POINTS) {
      const buyer = await this.userRepository.findOne({
        where: { id: buyerId },
        select: ['id', 'walletAddress'],
      });
      const builder = land.owner;
      if (!buyer?.walletAddress || !builder?.walletAddress) {
        throw new BadRequestException(
          'Buyer and builder must have wallet addresses for points payment',
        );
      }
      if (!this.blockchainService.isLedgerAvailable()) {
        throw new BadRequestException(
          'Ledger is not available. Points payment requires LandLedgerLite.',
        );
      }
      const balanceResult = await this.blockchainService.ledgerGetBalance(
        buyer.walletAddress,
      );
      if (!balanceResult.success || balanceResult.balance === undefined) {
        throw new BadRequestException(
          balanceResult.error ?? 'Could not fetch points balance',
        );
      }
      const amountInBaseUnits = BigInt(
        Math.floor(createPaymentDto.amount * 1e18),
      );
      const currentBalance = BigInt(balanceResult.balance);
      if (currentBalance < amountInBaseUnits) {
        throw new BadRequestException(
          `Insufficient points balance. Required: ${createPaymentDto.amount}, available: ${Number(balanceResult.balance) / 1e18}`,
        );
      }
      const transferResult =
        await this.blockchainService.ledgerTransferPoints(
          buyer.walletAddress,
          builder.walletAddress,
          amountInBaseUnits,
        );
      if (!transferResult.success) {
        throw new BadRequestException(
          transferResult.error ?? 'Points transfer failed',
        );
      }
      transactionHash = transferResult.transactionHash ?? undefined;
      initialStatus = PaymentStatus.VERIFIED;
    }

    // Upload proof file if provided (for BANK)
    if (file) {
      const uploadResult = await this.fileStorageService.uploadFile(
        'payment-proofs',
        file,
      );
      proofCID = uploadResult.path;

      // Also upload to IPFS for blockchain storage
      try {
        const ipfsResult = await this.ipfsService.uploadFile(file);
        proofIPFSHash = ipfsResult.hash;
      } catch (error) {
        console.error('Failed to upload proof to IPFS:', error);
        // Continue without IPFS hash if upload fails
      }
    }

    // Determine if this is a full payment (use computed totalPaid for resale correctness)
    const newTotalPaid = balanceInfo.totalPaid + createPaymentDto.amount;
    const isFullPayment = newTotalPaid >= Number(land.price);

    const payment = this.paymentRepository.create({
      landId: createPaymentDto.landId,
      agreementId: createPaymentDto.agreementId ?? null,
      installmentId: createPaymentDto.installmentId ?? null,
      buyerId,
      amount: createPaymentDto.amount,
      dueDate: createPaymentDto.dueDate
        ? new Date(createPaymentDto.dueDate)
        : null,
      paymentMode: createPaymentDto.paymentMode,
      proofCID: proofCID || undefined,
      transactionHash:
        transactionHash || createPaymentDto.transactionHash || undefined,
      status: initialStatus,
      paymentSequenceNumber,
      isFullPayment,
      isPartialPayment: !isFullPayment && newTotalPaid > 0,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // BANK only: record payment in LandLedgerLite (audit trail; ledger awards points to payee in recordPayment)
    if (createPaymentDto.paymentMode === PaymentMode.BANK) {
      try {
        const buyer = await this.userRepository.findOne({
          where: { id: buyerId },
          select: ['id', 'walletAddress'],
        });
        const builder = land.owner;
        if (
          buyer?.walletAddress &&
          builder?.walletAddress &&
          this.blockchainService.isLedgerAvailable()
        ) {
          const amountInBaseUnits = BigInt(
            Math.floor(createPaymentDto.amount * 1e18),
          );
          await this.blockchainService.ledgerRecordPayment(
            land.id,
            0,
            buyer.walletAddress,
            builder.walletAddress,
            '0x0000000000000000000000000000000000000000',
            amountInBaseUnits,
            savedPayment.id,
            builder.walletAddress, // builder: ledger registers property if missing
          );
        }
      } catch (error) {
        console.error('Error recording bank payment in ledger:', error);
        // Continue even if ledger fails
      }
    }

    // If installment is provided, mark it as paid (will be confirmed after verification for BANK)
    if (installment) {
      installment.status = InstallmentStatus.PAID;
      installment.paymentDate = new Date();
      await this.installmentRepository.save(installment);
    }

    // POINTS payments are already VERIFIED: update land totalPaid, status, and ownership if full
    if (initialStatus === PaymentStatus.VERIFIED && land) {
      await this.applyVerifiedPaymentToLand(land.id);
    }

    const savedWithRelations = await this.paymentRepository.findOne({
      where: { id: savedPayment.id },
      relations: ['land', 'buyer', 'agreement', 'installment'],
    });
    return PaymentResponseDto.fromEntity(savedWithRelations ?? savedPayment, true);
  }

  /**
   * Recalculate total paid from verified payments and update land (status, ownership if fully paid).
   * Used after a payment is verified (builder verify for BANK, or after POINTS transfer).
   */
  private async applyVerifiedPaymentToLand(landId: string): Promise<void> {
    const land = await this.landRepository.findOne({
      where: { id: landId },
      relations: ['owner'],
    });
    if (!land) return;

    const verifiedPayments = await this.paymentRepository.find({
      where: { landId, status: PaymentStatus.VERIFIED },
    });

    // For resale: only count payments after resaleListedAt (ignore first buyer's payments)
    const cutoff =
      land.resaleListedAt != null ? new Date(land.resaleListedAt) : null;
    const paymentsToSum =
      cutoff != null
        ? verifiedPayments.filter((p) => new Date(p.createdAt) >= cutoff)
        : verifiedPayments;

    const totalPaid = paymentsToSum.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    land.totalPaid = totalPaid;
    land.remainingBalance = land.price - totalPaid;
    if (land.status === LandStatus.AGREEMENT_PENDING) {
      land.status = LandStatus.PAYMENT_IN_PROGRESS;
    }
    // When fully paid: mark land ready for ownership document (builder upload → admin approve).
    // Ownership transfers only when admin approves the ownership document, not here.
    if (totalPaid >= land.price) {
      land.remainingBalance = 0;
      land.agreementStatus = LandAgreementStatus.COMPLETED;
      // Do not set ownerId/currentOwnerId or status=OWNED here; that happens in
      // ownership-documents when admin approves the ownership document.
    }
    await this.landRepository.save(land);
  }

  async findMyPayments(buyerId: string): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentRepository.find({
      where: { buyerId },
      relations: ['land'],
      order: { createdAt: 'DESC' },
    });

    return payments.map((payment) =>
      PaymentResponseDto.fromEntity(payment, true),
    );
  }

  /**
   * Find all payments for builder's lands (verified, pending, rejected)
   */
  async findPaymentsForBuilder(
    builderId: string,
  ): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.land', 'land')
      .leftJoin('payment.agreement', 'agreement')
      .leftJoinAndSelect('payment.buyer', 'buyer')
      .leftJoinAndSelect('payment.land', 'landData')
      .leftJoinAndSelect('payment.agreement', 'agreementData')
      .where(
        '(land.ownerId = :builderId OR (agreement.builderId = :builderId) OR (land.originalOwnerId = :builderId))',
        { builderId },
      )
      .orderBy('payment.createdAt', 'DESC')
      .getMany();

    return payments.map((payment) =>
      PaymentResponseDto.fromEntity(payment, true),
    );
  }

  /**
   * Find pending payments for builder (builder verifies payments, not seller)
   */
  async findPendingPaymentsForBuilder(
    builderId: string,
  ): Promise<PaymentResponseDto[]> {
    // Find all pending payments for properties owned by this builder
    // For resale properties, use original builder
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.land', 'land')
      .leftJoin('payment.agreement', 'agreement')
      .leftJoinAndSelect('payment.buyer', 'buyer')
      .leftJoinAndSelect('payment.land', 'landData')
      .leftJoinAndSelect('payment.agreement', 'agreementData')
      .where('payment.status = :status', { status: PaymentStatus.PENDING })
      .andWhere(
        '(land.ownerId = :builderId OR (agreement.builderId = :builderId) OR (land.originalOwnerId = :builderId))',
        { builderId },
      )
      .orderBy('payment.createdAt', 'DESC')
      .getMany();

    return payments.map((payment) =>
      PaymentResponseDto.fromEntity(payment, true),
    );
  }

  /**
   * @deprecated Use findPendingPaymentsForBuilder instead
   * Keep for backward compatibility
   */
  async findPendingPaymentsForSeller(
    sellerId: string,
  ): Promise<PaymentResponseDto[]> {
    return this.findPendingPaymentsForBuilder(sellerId);
  }

  async findOne(id: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['land', 'buyer'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return PaymentResponseDto.fromEntity(payment, true);
  }

  async verify(
    id: string,
    verifyPaymentDto: VerifyPaymentDto,
    builderId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['land', 'land.owner', 'agreement', 'agreement.builder'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment has already been processed');
    }

    // Verify that the builder can verify this payment
    // Builder can verify if:
    // 1. Builder owns the property (current owner)
    // 2. Builder is the original builder of the property
    // 3. Builder is linked through agreement
    const isBuilderOwner = payment.land.ownerId === builderId;
    const isOriginalBuilder = payment.land.originalOwnerId === builderId;
    const isAgreementBuilder = payment.agreement?.builderId === builderId;

    if (!isBuilderOwner && !isOriginalBuilder && !isAgreementBuilder) {
      throw new ForbiddenException(
        'You can only verify payments for properties you built or own',
      );
    }

    // Verify builder is verified
    const builder = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (
      !builder ||
      (builder.role !== UserRole.ADMIN && !builder.isBuilderVerified)
    ) {
      throw new ForbiddenException(
        'Only verified builders or admins can verify payments',
      );
    }

    // Update payment status
    payment.status = verifyPaymentDto.verified
      ? PaymentStatus.VERIFIED
      : PaymentStatus.REJECTED;
    payment.remarks = verifyPaymentDto.remarks || null;

    // Verify/reject bank payment on blockchain if payment mode is bank
    if (
      payment.paymentMode === PaymentMode.BANK &&
      payment.land.blockchainLandId &&
      this.blockchainService.isContractAvailable()
    ) {
      try {
        const verifyResult = await this.blockchainService.verifyBankPayment(
          payment.land.blockchainLandId,
          verifyPaymentDto.verified,
        );

        if (verifyResult.success && verifyResult.transactionHash) {
          // Update transaction hash if not already set
          if (!payment.transactionHash) {
            payment.transactionHash = verifyResult.transactionHash;
          }
          console.log(
            `Bank payment ${verifyPaymentDto.verified ? 'verified' : 'rejected'} on blockchain. TX: ${verifyResult.transactionHash}`,
          );
        } else {
          console.error(
            `Failed to ${verifyPaymentDto.verified ? 'verify' : 'reject'} bank payment on blockchain:`,
            verifyResult.error,
          );
          // Continue with database update even if blockchain fails
        }
      } catch (error) {
        console.error('Error verifying bank payment on blockchain:', error);
        // Continue with database update even if blockchain fails
      }
    }

    await this.paymentRepository.save(payment);

    // Update property payment tracking if payment is verified
    if (verifyPaymentDto.verified && payment.land) {
      await this.applyVerifiedPaymentToLand(payment.landId);
    } else if (!verifyPaymentDto.verified && payment.installmentId) {
      // If payment is rejected and was for an installment, reset installment status
      const installment = await this.installmentRepository.findOne({
        where: { id: payment.installmentId },
      });

      if (installment) {
        // Check if payment window is still valid
        const now = new Date();
        if (now <= installment.paymentWindowEnd) {
          installment.status = InstallmentStatus.PENDING;
        } else {
          installment.status = InstallmentStatus.OVERDUE;
        }
        installment.paymentDate = null;
        await this.installmentRepository.save(installment);
      }
    }

    const updatedPaymentWithRelations = await this.paymentRepository.findOne({
      where: { id },
      relations: ['land', 'buyer', 'agreement', 'installment'],
    });

    if (!updatedPaymentWithRelations) {
      throw new NotFoundException('Payment not found');
    }

    return PaymentResponseDto.fromEntity(updatedPaymentWithRelations, true);
  }

  /**
   * Calculate remaining balance for a property
   */
  async calculateRemainingBalance(propertyId: string): Promise<{
    totalPaid: number;
    remainingBalance: number;
    isFullyPaid: boolean;
  }> {
    const property = await this.landRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const verifiedPayments = await this.paymentRepository.find({
      where: {
        landId: propertyId,
        status: PaymentStatus.VERIFIED,
      },
    });

    // For resale: only count payments after resaleListedAt (ignore first buyer's payments)
    const cutoff =
      property.resaleListedAt != null
        ? new Date(property.resaleListedAt)
        : null;
    const paymentsToSum =
      cutoff != null
        ? verifiedPayments.filter((p) => new Date(p.createdAt) >= cutoff)
        : verifiedPayments;

    const totalPaid = paymentsToSum.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    const remainingBalance = Math.max(0, property.price - totalPaid);
    const isFullyPaid = remainingBalance === 0;

    return {
      totalPaid,
      remainingBalance,
      isFullyPaid,
    };
  }

  /**
   * Find payments by property ID
   */
  async findPaymentsByProperty(
    propertyId: string,
  ): Promise<PaymentResponseDto[]> {
    const property = await this.landRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const payments = await this.paymentRepository.find({
      where: { landId: propertyId },
      relations: ['land', 'buyer', 'agreement', 'installment'],
      order: { createdAt: 'DESC' },
    });

    return payments.map((payment) =>
      PaymentResponseDto.fromEntity(payment, true),
    );
  }

  /**
   * Find payments by agreement ID
   */
  async findPaymentsByAgreement(
    agreementId: string,
  ): Promise<PaymentResponseDto[]> {
    const agreement = await this.agreementRepository.findOne({
      where: { id: agreementId },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    const payments = await this.paymentRepository.find({
      where: { agreementId },
      relations: ['land', 'buyer', 'agreement', 'installment'],
      order: { createdAt: 'DESC' },
    });

    return payments.map((payment) =>
      PaymentResponseDto.fromEntity(payment, true),
    );
  }

  /**
   * Get installment summary for a property
   */
  async getInstallmentSummary(
    propertyId: string,
  ): Promise<InstallmentSummaryResponseDto> {
    const property = await this.landRepository.findOne({
      where: { id: propertyId },
      relations: ['project'],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const balanceInfo = await this.calculateRemainingBalance(propertyId);
    const payments = await this.findPaymentsByProperty(propertyId);
    const installments = await this.installmentRepository.find({
      where: { landId: propertyId },
      relations: ['agreement'],
      order: { paymentWindowStart: 'ASC' },
    });

    return {
      totalPaid: parseFloat(balanceInfo.totalPaid.toString()),
      remainingBalance: parseFloat(balanceInfo.remainingBalance.toString()),
      totalAmount: parseFloat(property.price.toString()),
      payments,
      installments: installments.map((inst) => ({
        id: inst.id,
        amount: parseFloat(inst.amount.toString()),
        paymentWindowStart: inst.paymentWindowStart,
        paymentWindowEnd: inst.paymentWindowEnd,
        paymentDate: inst.paymentDate ?? undefined,
        status: inst.status,
      })),
    };
  }
}
