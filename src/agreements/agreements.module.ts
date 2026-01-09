import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgreementsController } from './agreements.controller';
import { AgreementsService } from './agreements.service';
import { Agreement } from '../entities/agreement.entity';
import { Land } from '../entities/land.entity';
import { User } from '../entities/user.entity';
import { OwnershipHistory } from '../entities/ownership-history.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agreement, Land, User, OwnershipHistory]),
    CommonModule,
  ],
  controllers: [AgreementsController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}
