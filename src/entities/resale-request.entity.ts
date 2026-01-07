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

export enum ResaleRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  LISTED = 'listed',
  SOLD = 'sold',
}

@Entity('resale_requests')
export class ResaleRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  propertyId: string; // FK to Property/Land

  @Column({ type: 'uuid' })
  currentOwnerId: string; // FK to User (seller - current owner)

  @Column({ type: 'uuid' })
  builderId: string; // FK to User (original builder)

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  requestedPrice: number; // Seller's asking price

  @Column({
    type: 'enum',
    enum: ResaleRequestStatus,
    default: ResaleRequestStatus.PENDING,
  })
  status: ResaleRequestStatus;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null; // When builder approved the resale request

  @Column({ type: 'timestamp', nullable: true })
  listedAt: Date | null; // When builder lists it as resale property

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Land, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyId' })
  property: Land;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currentOwnerId' })
  currentOwner: User; // Seller

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'builderId' })
  builder: User; // Original builder
}

