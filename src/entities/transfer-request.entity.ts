import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Land } from './land.entity';
import { ResaleRequest } from './resale-request.entity';
import { TransferDocument } from './transfer-document.entity';

export enum TransferRequestStatus {
  PENDING_PAYMENT_CONFIRMATION = 'pending_payment_confirmation', // Waiting for seller to confirm payment
  PENDING_BUILDER_DOCUMENTS = 'pending_builder_documents',
  PENDING_ADMIN_APPROVAL = 'pending_admin_approval', // Waiting for admin review
  APPROVED = 'approved', // Admin approved
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  PENDING_SELLER_PAYMENT_CONFIRMATION = 'pending_seller_payment_confirmation',
  DOCUMENTS_UPLOADED = 'documents_uploaded',
}

@Entity('transfer_requests')
export class TransferRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  resaleRequestId: string; // FK to ResaleRequest

  @Column({ type: 'uuid' })
  propertyId: string; // FK to Property/Land

  @Column({ type: 'uuid' })
  currentOwnerId: string; // FK to User (seller - current owner)

  @Column({ type: 'uuid' })
  newOwnerId: string; // FK to User (buyer - new owner)

  @Column({
    type: 'enum',
    enum: TransferRequestStatus,
    default: TransferRequestStatus.PENDING_BUILDER_DOCUMENTS,
  })
  status: TransferRequestStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null; // Seller's notes/approval message

  @Column({ type: 'text', nullable: true })
  builderNotes: string | null; // Builder's notes when uploading documents

  // Payment confirmation fields
  @Column({ type: 'boolean', nullable: true })
  paymentConfirmed: boolean | null; // Seller confirms payment received

  @Column({ type: 'timestamp', nullable: true })
  paymentConfirmedAt: Date | null; // When seller confirmed payment

  @Column({ type: 'boolean', nullable: true })
  documentChangeAllowed: boolean | null; // Seller allows document change

  // Admin review fields
  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string | null; // FK to User (admin who reviewed)

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null; // When admin reviewed

  @Column({ type: 'text', nullable: true })
  adminNotes: string | null; // Admin's review notes

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null; // Reason for rejection if rejected

  @Column({ type: 'timestamp' })
  signedAt: Date; // When seller signed/approved the transfer request

  @Column({ type: 'timestamp', nullable: true })
  uploadedAt: Date | null; // When builder uploaded documents

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null; // When transfer was completed

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ResaleRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resaleRequestId' })
  resaleRequest: ResaleRequest;

  @ManyToOne(() => Land, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyId' })
  property: Land;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currentOwnerId' })
  currentOwner: User; // Seller

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'newOwnerId' })
  newOwner: User; // Buyer

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedBy' })
  reviewer: User | null; // Admin who reviewed

  @OneToMany(() => TransferDocument, (doc) => doc.transferRequest, {
    cascade: true,
  })
  documents: TransferDocument[];
}
