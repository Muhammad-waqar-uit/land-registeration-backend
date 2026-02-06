import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Land } from '../entities/land.entity';
import { BlockchainService } from '../common/services/blockchain.service';

/**
 * Payment verification scheduler.
 * All payments are bank payments; verification is done by builder via API.
 * Ledger (LandLedgerLite) is used for points recording only. No ERC20/crypto auto-verify.
 */
@Injectable()
export class PaymentVerificationScheduler {
  private readonly logger = new Logger(PaymentVerificationScheduler.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Land)
    private readonly landRepository: Repository<Land>,
    private readonly blockchainService: BlockchainService,
  ) {}
}
