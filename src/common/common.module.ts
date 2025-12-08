import { Module } from '@nestjs/common';
import { FileStorageService } from './services/file-storage.service';
import { EmailService } from './services/email.service';

@Module({
  providers: [FileStorageService, EmailService],
  exports: [FileStorageService, EmailService],
})
export class CommonModule {}
