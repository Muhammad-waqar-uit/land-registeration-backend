import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenRequestsController } from './token-requests.controller';
import { TokenRequestsService } from './token-requests.service';
import { TokenRequest } from '../entities/token-request.entity';
import { User } from '../entities/user.entity';
import { MulterModule } from '@nestjs/platform-express';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenRequest, User]),
    TokensModule,
    MulterModule.register({
      dest: './uploads/screenshots',
    }),
  ],
  controllers: [TokenRequestsController],
  providers: [TokenRequestsService],
  exports: [TokenRequestsService],
})
export class TokenRequestsModule {}
