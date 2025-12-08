import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    private fileStorageService: FileStorageService,
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

    // Upload proof file if provided
    if (file) {
      const uploadResult = await this.fileStorageService.uploadFile(
        'payment-proofs',
        file,
      );
      proofCID = uploadResult.path;
    }

    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      buyerId,
      proofCID,
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

  async findPendingPayments(): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentRepository.find({
      where: { status: PaymentStatus.PENDING },
      relations: ['buyer', 'land'],
      order: { createdAt: 'DESC' },
    });

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
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['land'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment has already been processed');
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
