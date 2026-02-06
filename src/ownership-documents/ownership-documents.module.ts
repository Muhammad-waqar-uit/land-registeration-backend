import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnershipDocumentsController } from './ownership-documents.controller';
import { OwnershipDocumentsService } from './ownership-documents.service';
import { OwnershipDocument } from '../entities/ownership-document.entity';
import { OwnershipDocumentFile } from '../entities/ownership-document-file.entity';
import { Land } from '../entities/land.entity';
import { User } from '../entities/user.entity';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            OwnershipDocument,
            OwnershipDocumentFile,
            Land,
            User,
        ]),
        CommonModule,
    ],
    controllers: [OwnershipDocumentsController],
    providers: [OwnershipDocumentsService],
    exports: [OwnershipDocumentsService],
})
export class OwnershipDocumentsModule { }
