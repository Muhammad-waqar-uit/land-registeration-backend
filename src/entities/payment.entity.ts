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

export enum PaymentStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
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

  @Column({ type: 'uuid' })
  buyerId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  dueDate: Date;

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

  @ManyToOne(() => User, (user) => user.payments)
  @JoinColumn({ name: 'buyerId' })
  buyer: User;
}
