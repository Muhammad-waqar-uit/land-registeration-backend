import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBankInfo } from '../entities/user-bank-info.entity';
import { UserBankInfoController } from './user-bank-info.controller';
import { UserBankInfoService } from './user-bank-info.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserBankInfo])],
  controllers: [UserBankInfoController],
  providers: [UserBankInfoService],
  exports: [UserBankInfoService],
})
export class UserBankInfoModule {}
