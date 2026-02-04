import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { OwnershipDocument } from './ownership-document.entity';

@Entity('ownership_document_files')
export class OwnershipDocumentFile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    ownershipDocumentId: string; // FK to OwnershipDocument

    @Column({ type: 'varchar', length: 255 })
    fileName: string; // Original filename

    @Column({ type: 'varchar', length: 500 })
    filePath: string; // Local storage path

    @Column({ type: 'varchar', length: 1000 })
    fileUrl: string; // Full URL for accessing the file

    @Column({ type: 'varchar', length: 64 })
    fileHash: string; // SHA-256 hash for integrity verification

    @Column({ type: 'text', nullable: true })
    ipfsHash: string | null; // IPFS hash (optional)

    @Column({ type: 'integer' })
    fileSize: number; // File size in bytes

    @Column({ type: 'varchar', length: 100 })
    mimeType: string; // MIME type (e.g., application/pdf)

    @Column({ type: 'timestamp' })
    uploadedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @ManyToOne(() => OwnershipDocument, (doc) => doc.documents, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'ownershipDocumentId' })
    ownershipDocument: OwnershipDocument;
}
