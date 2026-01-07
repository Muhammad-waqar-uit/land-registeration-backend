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

export enum PropertyRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('property_requests')
export class PropertyRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  propertyId: string; // FK to Property/Land

  @Column({ type: 'uuid' })
  buyerId: string; // FK to User (buyer)

  @Column({
    type: 'enum',
    enum: PropertyRequestStatus,
    default: PropertyRequestStatus.PENDING,
  })
  status: PropertyRequestStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  requestedPrice: number | null; // Optional, buyer's offer price

  @Column({ type: 'text', nullable: true })
  builderResponse: string | null; // Builder's response/notes

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null; // When builder responded to the request

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
}

