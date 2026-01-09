import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageService } from './services/file-storage.service';
import { EmailService } from './services/email.service';
import { WalletService } from './services/wallet.service';
import { BlockchainService } from './services/blockchain.service';
import { IpfsService } from './services/ipfs.service';
import { HashService } from './services/hash.service';
import { PropertyOwnerGuard } from './guards/property-owner.guard';
import { Land } from '../entities/land.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Land])],
  providers: [
    FileStorageService,
    EmailService,
    WalletService,
    BlockchainService,
    IpfsService,
    HashService,
    PropertyOwnerGuard,
  ],
  exports: [
    FileStorageService,
    EmailService,
    WalletService,
    BlockchainService,
    IpfsService,
    HashService,
    PropertyOwnerGuard,
  ],
})
export class CommonModule {}
