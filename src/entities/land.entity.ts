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
import { Payment } from './payment.entity';
import { Reservation } from './reservation.entity';

export enum LandStatus {
  AVAILABLE = 'available',
  LOCKED = 'locked',
  SOLD = 'sold',
}

@Entity('lands')
export class Land {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  location: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  size: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: LandStatus,
    default: LandStatus.AVAILABLE,
  })
  status: LandStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  documentHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  documentCID: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.ownedLands)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @OneToMany(() => Payment, (payment) => payment.land)
  payments: Payment[];

  @OneToMany(() => Reservation, (reservation) => reservation.land)
  reservations: Reservation[];
}
