import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuildersController } from './builders.controller';
import { BuildersService } from './builders.service';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { Land } from '../entities/land.entity';
import { Payment } from '../entities/payment.entity';
import { PropertyRequestsModule } from '../property-requests/property-requests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Project, Land, Payment]),
    PropertyRequestsModule,
  ],
  controllers: [BuildersController],
  providers: [BuildersService],
  exports: [BuildersService],
})
export class BuildersModule {}
