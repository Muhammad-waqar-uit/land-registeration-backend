import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentVerificationScheduler } from './payment-verification.scheduler';
import { Payment } from '../entities/payment.entity';
import { Land } from '../entities/land.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Land]), CommonModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentVerificationScheduler],
  exports: [PaymentsService],
})
export class PaymentsModule {}
