import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Payment, PaymentStatus, PaymentMode } from '../entities/payment.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { BlockchainService } from '../common/services/blockchain.service';

@Injectable()
export class PaymentVerificationScheduler {
  private readonly logger = new Logger(PaymentVerificationScheduler.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * Automatically verify crypto payments every 30 seconds
   * Checks pending crypto payments with transaction hashes
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async verifyCryptoPayments() {
    // Skip if blockchain service is not available
    if (!this.blockchainService.isAvailable()) {
      return;
    }

    try {
      // Find all pending crypto payments with transaction hashes
      const pendingCryptoPayments = await this.paymentRepository.find({
        where: {
          status: PaymentStatus.PENDING,
          paymentMode: PaymentMode.CRYPTO,
        },
        relations: ['land'],
      });

      // Filter to only those with transaction hashes
      const paymentsToVerify = pendingCryptoPayments.filter(
        (p) => p.transactionHash && p.transactionHash.trim() !== '',
      );

      if (paymentsToVerify.length === 0) {
        return;
      }

      this.logger.log(
        `Checking ${paymentsToVerify.length} pending crypto payment(s) for verification...`,
      );

      for (const payment of paymentsToVerify) {
        try {
          // Verify transaction on blockchain
          const verification = await this.blockchainService.verifyTransaction(
            payment.transactionHash!,
            3, // Require at least 3 confirmations
          );

          if (verification.confirmed && verification.status === 1) {
            // Transaction is confirmed and successful - auto-verify payment
            payment.status = PaymentStatus.VERIFIED;
            payment.remarks = `Auto-verified: Transaction confirmed on blockchain (Block: ${verification.blockNumber}, Confirmations: ${verification.confirmations})`;

            await this.paymentRepository.save(payment);

            this.logger.log(
              `✅ Auto-verified crypto payment ${payment.id} (Transaction: ${payment.transactionHash})`,
            );

            // Update land status if all payments are verified
            if (payment.land) {
              await this.updateLandStatusIfAllPaymentsVerified(payment.landId);
            }
          } else if (verification.error) {
            // Log error but don't fail - might be pending
            this.logger.debug(
              `Payment ${payment.id} transaction ${payment.transactionHash} not yet confirmed: ${verification.error}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error verifying payment ${payment.id}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in crypto payment verification cron job:', error);
    }
  }

  /**
   * Update land status to SOLD if all payments are verified
   */
  private async updateLandStatusIfAllPaymentsVerified(
    landId: string,
  ): Promise<void> {
    try {
      const land = await this.landRepository.findOne({
        where: { id: landId },
        relations: [],
      });

      if (!land) {
        return;
      }

      // Get all payments for this land
      const allPayments = await this.paymentRepository.find({
        where: { landId },
      });

      // Check if all payments are verified
      const allVerified = allPayments.every(
        (p) => p.status === PaymentStatus.VERIFIED,
      );

      // Update land status if all payments verified and land is locked
      if (allVerified && land.status === LandStatus.LOCKED) {
        land.status = LandStatus.SOLD;
        await this.landRepository.save(land);

        this.logger.log(
          `✅ Updated land ${landId} status to SOLD (all payments verified)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating land status for ${landId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
