import { Module } from '@nestjs/common';
import { FileStorageService } from './services/file-storage.service';
import { EmailService } from './services/email.service';
import { WalletService } from './services/wallet.service';

@Module({
  providers: [FileStorageService, EmailService, WalletService],
  exports: [FileStorageService, EmailService, WalletService],
})
export class CommonModule {}
