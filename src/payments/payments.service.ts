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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';
import { BlockchainService } from '../common/services/blockchain.service';
import { WalletService } from '../common/services/wallet.service';
import { User } from '../entities/user.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
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
    // Verify land exists
    const land = await this.landRepository.findOne({
      where: { id: createPaymentDto.landId },
    });

    if (!land) {
      throw new NotFoundException('Land not found');
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

    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      buyerId,
      proofCID,
      transactionHash,
    });

    const savedPayment = await this.paymentRepository.save(payment);
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

  async findPendingPaymentsForSeller(sellerId: string): Promise<PaymentResponseDto[]> {
    // Find all pending payments for lands owned by this seller
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.land', 'land')
      .leftJoinAndSelect('payment.buyer', 'buyer')
      .leftJoinAndSelect('payment.land', 'landData')
      .where('payment.status = :status', { status: PaymentStatus.PENDING })
      .andWhere('land.ownerId = :sellerId', { sellerId })
      .orderBy('payment.createdAt', 'DESC')
      .getMany();

    return payments.map((payment) =>
      PaymentResponseDto.fromEntity(payment, true),
    );
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
    sellerId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['land', 'land.owner'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment has already been processed');
    }

    // Verify that the seller owns the land for this payment
    if (payment.land.ownerId !== sellerId) {
      throw new ForbiddenException('You can only verify payments for your own lands');
    }

    // Update payment status
    payment.status = verifyPaymentDto.verified
      ? PaymentStatus.VERIFIED
      : PaymentStatus.REJECTED;
    payment.remarks = verifyPaymentDto.remarks || null;

    const updatedPayment = await this.paymentRepository.save(payment);

    // Update land status if payment is verified
    if (verifyPaymentDto.verified && payment.land) {
      // Check if all payments for this land are verified
      const allPayments = await this.paymentRepository.find({
        where: { landId: payment.landId },
      });

      const allVerified = allPayments.every(
        (p) => p.status === PaymentStatus.VERIFIED,
      );

      if (allVerified && payment.land.status === LandStatus.LOCKED) {
        payment.land.status = LandStatus.SOLD;
        await this.landRepository.save(payment.land);
      }
    }

    const updatedPaymentWithRelations = await this.paymentRepository.findOne({
      where: { id },
      relations: ['land', 'buyer'],
    });

    if (!updatedPaymentWithRelations) {
      throw new NotFoundException('Payment not found');
    }

    return PaymentResponseDto.fromEntity(
      updatedPaymentWithRelations,
      true,
    );
  }
}
