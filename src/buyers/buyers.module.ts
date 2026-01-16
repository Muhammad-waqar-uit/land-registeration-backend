import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuyersController } from './buyers.controller';
import { BuyersService } from './buyers.service';
import { Payment } from '../entities/payment.entity';
import { Land } from '../entities/land.entity';
import { Agreement } from '../entities/agreement.entity';
import { PropertyRequest } from '../entities/property-request.entity';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Land,
      Agreement,
      PropertyRequest,
      User,
      Project,
    ]),
  ],
  controllers: [BuyersController],
  providers: [BuyersService],
  exports: [BuyersService],
})
export class BuyersModule {}
