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

export enum InstallmentStatus {
  PENDING = 'pending', // Within payment window, not yet paid
  PAID = 'paid', // Paid (anytime within window)
  OVERDUE = 'overdue', // Payment window expired, not paid
}

@Entity('installments')
export class Installment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  landId: string; // FK to Property/Land (keeping for backward compatibility)

  @ManyToOne(() => Land, (land) => land.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'landId' })
  land: Land;

  @Column({ type: 'uuid', nullable: true })
  agreementId: string | null; // FK to Agreement (nullable - installments might exist before agreement)

  @ManyToOne(() => Agreement, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agreementId' })
  agreement: Agreement | null;

  @Column({ type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  // Timeline-based payment window (replaces fixed dueDate)
  @Column({ type: 'date' })
  paymentWindowStart: Date; // Start of payment window (from agreement start date)

  @Column({ type: 'date' })
  paymentWindowEnd: Date; // End of payment window (calculated from timeline)

  @Column({
    type: 'enum',
    enum: InstallmentStatus,
    default: InstallmentStatus.PENDING,
  })
  status: InstallmentStatus;

  @Column({ type: 'date', nullable: true })
  paymentDate: Date | null; // Actual payment date (can be anytime within window)

  // Optional: Link to installment plan if InstallmentPlan entity is created
  @Column({ type: 'uuid', nullable: true })
  installmentPlanId: string | null; // FK to InstallmentPlan (if created)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
