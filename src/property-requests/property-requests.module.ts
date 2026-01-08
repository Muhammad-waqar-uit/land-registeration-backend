import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyRequestsController } from './property-requests.controller';
import { PropertyRequestsService } from './property-requests.service';
import { PropertyRequest } from '../entities/property-request.entity';
import { Land } from '../entities/land.entity';
import { User } from '../entities/user.entity';
import { LandsModule } from '../lands/lands.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropertyRequest, Land, User]),
    LandsModule,
  ],
  controllers: [PropertyRequestsController],
  providers: [PropertyRequestsService],
  exports: [PropertyRequestsService],
})
export class PropertyRequestsModule {}

