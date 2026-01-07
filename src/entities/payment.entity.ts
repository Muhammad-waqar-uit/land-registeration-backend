import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Land } from './land.entity';
import { User } from './user.entity';
import { Agreement } from './agreement.entity';
import { Installment } from './installment.entity';

export enum PaymentStatus {
  PENDING = 'pending', // Payment submitted, awaiting verification
  VERIFIED = 'verified', // Builder verified the payment
  REJECTED = 'rejected', // Builder rejected the payment
}

export enum PaymentMode {
  BANK = 'bank',
  CRYPTO = 'crypto',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  landId: string;

  @Column({ type: 'uuid', nullable: true })
  agreementId: string | null; // FK to Agreement

  @Column({ type: 'uuid' })
  buyerId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date', nullable: true })
  dueDate: Date | null; // Optional due date (for timeline-based payments, this may be null)

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMode,
  })
  paymentMode: PaymentMode;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proofCID: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionHash: string;

  @Column({ type: 'uuid', nullable: true })
  installmentId: string | null; // FK to Installment (nullable if full payment)

  @Column({ type: 'boolean', default: false })
  isFullPayment: boolean; // True if this payment completes the full amount

  @Column({ type: 'boolean', default: false })
  isPartialPayment: boolean; // True if this is a partial payment

  @Column({ type: 'int', nullable: true })
  paymentSequenceNumber: number | null; // Track payment order (1st payment, 2nd payment, etc.)

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Land, (land) => land.payments)
  @JoinColumn({ name: 'landId' })
  land: Land;

  @ManyToOne(() => Agreement, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agreementId' })
  agreement: Agreement | null;

  @ManyToOne(() => User, (user) => user.payments)
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @ManyToOne(() => Installment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'installmentId' })
  installment: Installment | null;
}
