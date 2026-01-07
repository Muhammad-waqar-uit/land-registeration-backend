import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Land } from './land.entity';
import { Payment } from './payment.entity';
import { Reservation } from './reservation.entity';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  BUILDER = 'builder',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  walletAddress: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cnic: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fatherName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber: string;

  @Column({ type: 'boolean', default: false })
  isBuilderVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  builderVerifiedAt: Date | null;

  // Builder-specific fields (nullable, only populated when role is BUILDER)
  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  licenseNumber: string | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string | null; // Admin who verified this builder

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'verifiedBy' })
  verifier: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Land, (land) => land.owner)
  ownedLands: Land[];

  @OneToMany(() => Payment, (payment) => payment.buyer)
  payments: Payment[];

  @OneToMany(() => Reservation, (reservation) => reservation.buyer)
  reservations: Reservation[];
}
