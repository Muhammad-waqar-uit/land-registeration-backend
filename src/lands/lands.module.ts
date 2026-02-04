import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandsController } from './lands.controller';
import { LandsService } from './lands.service';
import { Land } from '../entities/land.entity';
import { Agreement } from '../entities/agreement.entity';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Land, Agreement, Payment, User, Project]),
    CommonModule,
  ],
  controllers: [LandsController],
  providers: [LandsService],
  exports: [LandsService],
})
export class LandsModule {}
