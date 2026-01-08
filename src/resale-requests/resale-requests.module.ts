import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResaleRequestsController } from './resale-requests.controller';
import { ResaleRequestsService } from './resale-requests.service';
import { ResaleRequest } from '../entities/resale-request.entity';
import { Land } from '../entities/land.entity';
import { User } from '../entities/user.entity';
import { LandsModule } from '../lands/lands.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResaleRequest, Land, User]),
    LandsModule,
  ],
  controllers: [ResaleRequestsController],
  providers: [ResaleRequestsService],
  exports: [ResaleRequestsService],
})
export class ResaleRequestsModule {}

