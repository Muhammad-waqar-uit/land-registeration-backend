import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { TransferRequest } from './transfer-request.entity';

export enum TransferDocumentType {
  TRANSFER_DEED = 'transfer_deed',
  NOC = 'noc', // No Objection Certificate
  OWNERSHIP = 'ownership',
  OTHER = 'other',
}

@Entity('transfer_documents')
export class TransferDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  transferRequestId: string; // FK to TransferRequest

  @Column({
    type: 'enum',
    enum: TransferDocumentType,
    default: TransferDocumentType.OTHER,
  })
  documentType: TransferDocumentType;

  @Column({ type: 'varchar', length: 500 })
  documentCID: string; // Local file path/CID

  @Column({ type: 'varchar', length: 1000 })
  documentUrl: string; // Full URL for accessing the document

  @Column({ type: 'varchar', length: 64 })
  documentHash: string; // SHA-256 hash for integrity verification

  @Column({ type: 'text', nullable: true })
  ipfsHash: string | null; // IPFS hash (optional)

  @Column({ type: 'uuid' })
  uploadedBy: string; // FK to User (builder who uploaded)

  @Column({ type: 'timestamp' })
  uploadedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => TransferRequest, (tr) => tr.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transferRequestId' })
  transferRequest: TransferRequest;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploadedBy' })
  uploader: User; // Builder
}
