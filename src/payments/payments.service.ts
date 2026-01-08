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
import { Land, LandStatus } from '../entities/land.entity';
import { Agreement, AgreementStatus } from '../entities/agreement.entity';
import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';
import { BlockchainService } from '../common/services/blockchain.service';
import { WalletService } from '../common/services/wallet.service';

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
    private walletService: WalletService,
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
        throw new BadRequestException('Agreement does not belong to this property');
      }

      if (agreement.buyerId !== buyerId) {
        throw new ForbiddenException('Agreement does not belong to this buyer');
      }

      // Verify agreement is signed
      if (agreement.status !== AgreementStatus.SIGNED) {
        throw new BadRequestException('Agreement must be signed before making payments');
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
        throw new BadRequestException('Installment does not belong to this property');
      }

      if (installment.buyerId !== buyerId) {
        throw new ForbiddenException('Installment does not belong to this buyer');
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
    const remainingBalance = land.remainingBalance ?? land.price;
    if (createPaymentDto.amount > remainingBalance) {
      throw new BadRequestException(
        `Payment amount (${createPaymentDto.amount}) exceeds remaining balance (${remainingBalance})`,
      );
    }

    let proofCID: string | undefined;
    let transactionHash: string | undefined;

    // Upload proof file if provided
    if (file) {
      const uploadResult = await this.fileStorageService.uploadFile(
        'payment-proofs',
        file,
      );
      proofCID = uploadResult.path;
    }

    // Process ERC20 payment on blockchain if payment mode is crypto
    if (
      createPaymentDto.paymentMode === PaymentMode.CRYPTO &&
      land.blockchainLandId &&
      this.blockchainService.isContractAvailable()
    ) {
      try {
        // Get buyer user to get wallet address
        const buyer = await this.userRepository.findOne({
          where: { id: buyerId },
          select: ['id', 'walletAddress'],
        });

        if (!buyer) {
          throw new NotFoundException('Buyer not found');
        }

        if (!buyer.walletAddress) {
          throw new BadRequestException(
            'Buyer must have a wallet address for crypto payments',
          );
        }

        // Get buyer's private key from HD wallet
        const buyerPrivateKey =
          this.walletService.getPrivateKeyFromUserId(buyerId);

        // Convert amount to base units (assuming 18 decimals, will be adjusted in blockchain service)
        const amountInBaseUnits = BigInt(
          Math.floor(createPaymentDto.amount * 1e18),
        );

        // Make payment on blockchain
        const paymentResult = await this.blockchainService.makeERC20Payment(
          land.blockchainLandId,
          buyerPrivateKey,
          amountInBaseUnits,
        );

        if (paymentResult.success && paymentResult.transactionHash) {
          transactionHash = paymentResult.transactionHash;
          console.log(
            `ERC20 payment processed on blockchain. TX: ${paymentResult.transactionHash}`,
          );
        } else {
          console.error(
            'Failed to process ERC20 payment on blockchain:',
            paymentResult.error,
          );
          // Continue with database payment record even if blockchain fails
        }
      } catch (error) {
        console.error('Error processing ERC20 payment:', error);
        // Continue with database payment record even if blockchain fails
      }
    }

    // Determine if this is a full payment
    const newTotalPaid = (land.totalPaid || 0) + createPaymentDto.amount;
    const isFullPayment = newTotalPaid >= land.price;

    const payment = this.paymentRepository.create({ 
      landId: createPaymentDto.landId,
      agreementId: createPaymentDto.agreementId ?? null,
      installmentId: createPaymentDto.installmentId ?? null,
      buyerId,
      amount: createPaymentDto.amount,
      dueDate: createPaymentDto.dueDate ? new Date(createPaymentDto.dueDate) : null,
      paymentMode: createPaymentDto.paymentMode,
      proofCID: proofCID || undefined,
      transactionHash: transactionHash || createPaymentDto.transactionHash || undefined,
      status: PaymentStatus.PENDING,
      paymentSequenceNumber,
      isFullPayment,
      isPartialPayment: !isFullPayment && newTotalPaid > 0,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // If installment is provided, mark it as paid (will be confirmed after verification)
    if (installment) {
      installment.status = InstallmentStatus.PAID;
      installment.paymentDate = new Date();
      await this.installmentRepository.save(installment);
    }

    return PaymentResponseDto.fromEntity(savedPayment);
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
   * Find pending payments for builder (builder verifies payments, not seller)
   */
  async findPendingPaymentsForBuilder(builderId: string): Promise<PaymentResponseDto[]> {
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
  async findPendingPaymentsForSeller(sellerId: string): Promise<PaymentResponseDto[]> {
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

    if (!builder || (builder.role !== UserRole.ADMIN && !builder.isBuilderVerified)) {
      throw new ForbiddenException(
        'Only verified builders or admins can verify payments',
      );
    }

    // Update payment status
    payment.status = verifyPaymentDto.verified
      ? PaymentStatus.VERIFIED
      : PaymentStatus.REJECTED;
    payment.remarks = verifyPaymentDto.remarks || null;

    const updatedPayment = await this.paymentRepository.save(payment);

    // Update property payment tracking if payment is verified
    if (verifyPaymentDto.verified && payment.land) {
      // Calculate total paid from all verified payments
      const verifiedPayments = await this.paymentRepository.find({
        where: {
          landId: payment.landId,
          status: PaymentStatus.VERIFIED,
        },
      });

      const totalPaid = verifiedPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );

      // Update property
      payment.land.totalPaid = totalPaid;
      payment.land.remainingBalance = payment.land.price - totalPaid;

      // Update property status based on payment progress
      if (payment.land.status === LandStatus.AGREEMENT_PENDING) {
        payment.land.status = LandStatus.PAYMENT_IN_PROGRESS;
      }

      // If fully paid, mark as owned
      if (totalPaid >= payment.land.price) {
        payment.land.remainingBalance = 0;
        payment.land.status = LandStatus.OWNED;
        payment.land.currentOwnerId = payment.buyerId;
        // Note: Ownership transfer to buyer will be completed via final agreement
      }

      await this.landRepository.save(payment.land);
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

    return PaymentResponseDto.fromEntity(
      updatedPaymentWithRelations,
      true,
    );
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

    const totalPaid = verifiedPayments.reduce(
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
  async findPaymentsByProperty(propertyId: string): Promise<PaymentResponseDto[]> {
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

    return payments.map((payment) => PaymentResponseDto.fromEntity(payment, true));
  }

  /**
   * Find payments by agreement ID
   */
  async findPaymentsByAgreement(agreementId: string): Promise<PaymentResponseDto[]> {
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

    return payments.map((payment) => PaymentResponseDto.fromEntity(payment, true));
  }

  /**
   * Get installment summary for a property
   */
  async getInstallmentSummary(propertyId: string): Promise<{
    totalPaid: number;
    remainingBalance: number;
    totalAmount: number;
    payments: PaymentResponseDto[];
    installments: any[];
  }> {
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
      totalPaid: balanceInfo.totalPaid,
      remainingBalance: balanceInfo.remainingBalance,
      totalAmount: property.price,
      payments,
      installments: installments.map((inst) => ({
        id: inst.id,
        amount: inst.amount,
        paymentWindowStart: inst.paymentWindowStart,
        paymentWindowEnd: inst.paymentWindowEnd,
        paymentDate: inst.paymentDate,
        status: inst.status,
      })),
    };
  }
}
