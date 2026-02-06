import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { TransferRequestsController } from './transfer-requests.controller';
import { TransferRequestsService } from './transfer-requests.service';
import { TransferRequest } from '../entities/transfer-request.entity';
import { TransferDocument } from '../entities/transfer-document.entity';
import { ResaleRequest } from '../entities/resale-request.entity';
import { Land } from '../entities/land.entity';
import { User } from '../entities/user.entity';
import { OwnershipHistory } from '../entities/ownership-history.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransferRequest,
      TransferDocument,
      ResaleRequest,
      Land,
      User,
      OwnershipHistory,
    ]),
    MulterModule.register({
      dest: './uploads/transfer-docs',
    }),
    CommonModule,
  ],
  controllers: [TransferRequestsController],
  providers: [TransferRequestsService],
  exports: [TransferRequestsService],
})
export class TransferRequestsModule {}
