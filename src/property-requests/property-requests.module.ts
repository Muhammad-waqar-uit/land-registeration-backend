import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyRequestsController } from './property-requests.controller';
import { PropertyRequestsService } from './property-requests.service';
import { PropertyRequest } from '../entities/property-request.entity';
import { Land } from '../entities/land.entity';
import { User } from '../entities/user.entity';
import { Agreement } from '../entities/agreement.entity';
import { LandsModule } from '../lands/lands.module';
import { AgreementsModule } from '../agreements/agreements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropertyRequest, Land, User, Agreement]),
    LandsModule,
    AgreementsModule, // Import to allow future integration for auto-agreement creation
  ],
  controllers: [PropertyRequestsController],
  providers: [PropertyRequestsService],
  exports: [PropertyRequestsService],
})
export class PropertyRequestsModule {}
