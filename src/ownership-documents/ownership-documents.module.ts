import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnershipDocumentsController } from './ownership-documents.controller';
import { OwnershipDocumentsService } from './ownership-documents.service';
import { OwnershipDocument } from '../entities/ownership-document.entity';
import { OwnershipDocumentFile } from '../entities/ownership-document-file.entity';
import { Land } from '../entities/land.entity';
import { User } from '../entities/user.entity';
import { FileStorageService } from '../common/services/file-storage.service';
import { HashService } from '../common/services/hash.service';
import { IpfsService } from '../common/services/ipfs.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            OwnershipDocument,
            OwnershipDocumentFile,
            Land,
            User,
        ]),
    ],
    controllers: [OwnershipDocumentsController],
    providers: [
        OwnershipDocumentsService,
        FileStorageService,
        HashService,
        IpfsService,
    ],
    exports: [OwnershipDocumentsService],
})
export class OwnershipDocumentsModule { }
