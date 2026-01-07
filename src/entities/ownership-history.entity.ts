import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Land } from './land.entity';
import { Agreement } from './agreement.entity';

export enum TransferType {
  INITIAL_SALE = 'initial_sale', // First sale from builder to buyer
  RESALE = 'resale', // Resale from one owner to another
}

@Entity('ownership_history')
export class OwnershipHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  propertyId: string; // FK to Property/Land

  @Column({ type: 'uuid', nullable: true })
  fromOwnerId: string | null; // FK to User (nullable if initial from builder)

  @Column({ type: 'uuid' })
  toOwnerId: string; // FK to User (new owner)

  @Column({
    type: 'enum',
    enum: TransferType,
  })
  transferType: TransferType;

  @Column({ type: 'uuid' })
  agreementId: string; // FK to Agreement

  @Column({ type: 'varchar', length: 66, nullable: true })
  blockchainTxHash: string | null; // Transaction hash for ownership transfer on blockchain

  @Column({ type: 'timestamp' })
  transferredAt: Date; // When ownership was transferred

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Land, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyId' })
  property: Land;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fromOwnerId' })
  fromOwner: User | null; // Previous owner (null if initial sale from builder)

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'toOwnerId' })
  toOwner: User; // New owner

  @ManyToOne(() => Agreement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agreementId' })
  agreement: Agreement;
}

