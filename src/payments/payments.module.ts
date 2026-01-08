import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentVerificationScheduler } from './payment-verification.scheduler';
import { Payment } from '../entities/payment.entity';
import { Land } from '../entities/land.entity';
import { Agreement } from '../entities/agreement.entity';
import { Installment } from '../entities/installment.entity';
import { User } from '../entities/user.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Land, Agreement, Installment, User]),
    CommonModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentVerificationScheduler],
  exports: [PaymentsService],
})
export class PaymentsModule {}
