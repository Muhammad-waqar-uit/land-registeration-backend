import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstallmentsController } from './installments.controller';
import { InstallmentsService } from './installments.service';
import { Installment } from '../entities/installment.entity';
import { Agreement } from '../entities/agreement.entity';
import { Land } from '../entities/land.entity';
import { Payment } from '../entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Installment, Agreement, Land, Payment])],
  controllers: [InstallmentsController],
  providers: [InstallmentsService],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}
