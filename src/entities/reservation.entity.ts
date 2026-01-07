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

/**
 * @deprecated This entity is deprecated. Use PropertyRequest entity instead.
 * Reservation functionality has been replaced by PropertyRequest in the builder-centric model.
 * This entity is kept for backward compatibility during migration period.
 * TODO: Remove this entity after data migration to PropertyRequest is complete.
 */
export enum ReservationStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
}

/**
 * @deprecated This entity is deprecated. Use PropertyRequest entity instead.
 * Reservation functionality has been replaced by PropertyRequest in the builder-centric model.
 * This entity is kept for backward compatibility during migration period.
 * TODO: Remove this entity after data migration to PropertyRequest is complete.
 */
@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  landId: string;

  @Column({ type: 'uuid' })
  buyerId: string;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.ACTIVE,
  })
  status: ReservationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Land, (land) => land.reservations)
  @JoinColumn({ name: 'landId' })
  land: Land;

  @ManyToOne(() => User, (user) => user.reservations)
  @JoinColumn({ name: 'buyerId' })
  buyer: User;
}
