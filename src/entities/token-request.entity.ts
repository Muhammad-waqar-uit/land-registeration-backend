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

export enum TokenRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('token_requests')
export class TokenRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string; // FK to User (buyer/seller/builder)

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  screenshotUrl: string | null; // URL/path to uploaded screenshot

  @Column({
    type: 'enum',
    enum: TokenRequestStatus,
    default: TokenRequestStatus.PENDING,
  })
  status: TokenRequestStatus;

  @Column({ type: 'text', nullable: true })
  adminResponse: string | null; // Admin's response/notes

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string | null; // Admin who reviewed this request

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null; // When admin responded to the request

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedBy' })
  reviewer: User | null;
}
