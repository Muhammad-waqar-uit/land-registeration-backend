import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Land } from './land.entity';

export enum AgreementType {
  INITIAL = 'initial',
  FINAL_OWNERSHIP = 'final_ownership',
}

export enum AgreementStatus {
  DRAFT = 'draft',
  PENDING_SIGNATURE = 'pending_signature',
  SIGNED = 'signed',
  COMPLETED = 'completed',
}

@Entity('agreements')
export class Agreement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  propertyId: string; // FK to Property/Land

  @Column({ type: 'uuid' })
  buyerId: string; // FK to User

  @Column({ type: 'uuid' })
  builderId: string; // FK to User - builder

  @Column({
    type: 'enum',
    enum: AgreementType,
  })
  agreementType: AgreementType;

  @Column({
    type: 'enum',
    enum: AgreementStatus,
    default: AgreementStatus.DRAFT,
  })
  status: AgreementStatus;

  // Document storage fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  documentCID: string | null; // Local storage path

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentUrl: string | null; // Full URL to document

  @Column({ type: 'text', nullable: true })
  documentIPFSHash: string | null; // IPFS hash for immutable storage

  @Column({ type: 'varchar', length: 64, nullable: true })
  documentHash: string | null; // SHA-256 hash for tamper detection

  // Signature fields
  @Column({ type: 'timestamp', nullable: true })
  buyerSignedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  builderSignedAt: Date | null;

  // Signed document storage fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  signedDocumentCID: string | null; // Signed version - local storage path

  @Column({ type: 'varchar', length: 500, nullable: true })
  signedDocumentUrl: string | null; // Signed version - full URL to document

  @Column({ type: 'text', nullable: true })
  signedDocumentIPFSHash: string | null; // Signed version - IPFS hash

  @Column({ type: 'varchar', length: 64, nullable: true })
  signedDocumentHash: string | null; // Signed version - SHA-256 hash

  // Blockchain fields
  @Column({ type: 'varchar', length: 66, nullable: true })
  blockchainTxHash: string | null; // Transaction hash for agreement hash on blockchain

  // Agreement terms (stored as JSON)
  @Column({ type: 'jsonb', nullable: true })
  terms: {
    price?: number;
    totalAmount?: number;
    installmentPlanYears?: number;
    installmentStartDate?: string;
    installmentEndDate?: string;
    paymentTerms?: string;
    propertyDetails?: Record<string, any>;
    buyerDetails?: {
      name?: string;
      fatherName?: string;
      cnic?: string;
      phoneNumber?: string;
    };
    builderDetails?: {
      name?: string;
      companyName?: string;
      licenseNumber?: string;
    };
    [key: string]: any;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Land, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyId' })
  property: Land;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'builderId' })
  builder: User;
}
