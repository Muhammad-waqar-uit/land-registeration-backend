import { Module } from '@nestjs/common';
import { FileStorageService } from './services/file-storage.service';
import { EmailService } from './services/email.service';
import { WalletService } from './services/wallet.service';
import { BlockchainService } from './services/blockchain.service';
import { IpfsService } from './services/ipfs.service';
import { HashService } from './services/hash.service';

@Module({
  providers: [FileStorageService, EmailService, WalletService, BlockchainService, IpfsService, HashService],
  exports: [FileStorageService, EmailService, WalletService, BlockchainService, IpfsService, HashService],
})
export class CommonModule {}
