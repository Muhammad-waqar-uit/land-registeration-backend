import { Module } from '@nestjs/common';
import { FileStorageService } from './services/file-storage.service';
import { EmailService } from './services/email.service';
import { WalletService } from './services/wallet.service';
import { BlockchainService } from './services/blockchain.service';

@Module({
  providers: [FileStorageService, EmailService, WalletService, BlockchainService],
  exports: [FileStorageService, EmailService, WalletService, BlockchainService],
})
export class CommonModule {}
