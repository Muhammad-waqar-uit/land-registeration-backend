import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Payment } from './payment.entity';
import { Project } from './project.entity';
import { Installment } from './installment.entity';

export enum LandStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  AGREEMENT_PENDING = 'agreement_pending',
  PAYMENT_IN_PROGRESS = 'payment_in_progress',
  OWNED = 'owned',
  RESALE_LISTED = 'resale_listed',
  // Legacy statuses (deprecated, kept for backward compatibility)
  LOCKED = 'locked',
  SOLD = 'sold',
}

export enum AgreementStatus {
  NONE = 'none',
  PENDING = 'pending',
  SIGNED = 'signed',
  COMPLETED = 'completed',
}

@Entity('lands')
@Index('idx_lands_unit_project', ['projectId', 'unitId'], { unique: true }) // Ensure unitId is unique within each project
export class Land {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  location: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  unitId: string | null; // Auto-generated unique unit identifier (e.g., "SV-1", "ABC-2")

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null; // FK to Project (already exists in relation)

  @Column({ type: 'boolean', default: false })
  isResale: boolean; // Mark if resale property

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

  // Document fields (deprecated - will move to Agreement entity, kept for backward compatibility)
  @Column({ type: 'varchar', length: 255, nullable: true })
  documentCID: string | null; // @deprecated - Move to Agreement entity

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentUrl: string | null; // @deprecated

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageCID: string | null; // Keep for property images

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null; // Keep for property images

  @Column({ type: 'text', nullable: true })
  documentIPFSHash: string | null; // @deprecated

  @Column({ type: 'text', nullable: true })
  imageIPFSHash: string | null; // Keep for property images

  @Column({ type: 'varchar', length: 64, nullable: true })
  documentHash: string | null; // @deprecated - SHA-256 hash for tamper detection

  @Column({ type: 'varchar', length: 64, nullable: true })
  imageHash: string | null; // Keep for property image verification

  @Column({ type: 'uuid' })
  ownerId: string; // Current owner (builder for new properties, buyer after sale)

  @Column({ type: 'uuid', nullable: true })
  originalOwnerId: string | null; // For resale properties, track original owner

  @Column({ type: 'uuid', nullable: true })
  currentOwnerId: string | null; // Current owner (nullable if available/owned by builder)

  // Installment plan fields
  @Column({ type: 'int', nullable: true })
  installmentPlanYears: number | null; // 2, 3, or 5 years

  @Column({ type: 'date', nullable: true })
  installmentStartDate: Date | null;

  @Column({ type: 'date', nullable: true })
  installmentEndDate: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPaid: number; // Calculated from payments

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  remainingBalance: number | null; // Calculated: price - totalPaid

  // Agreement status
  @Column({
    type: 'enum',
    enum: AgreementStatus,
    default: AgreementStatus.NONE,
  })
  agreementStatus: AgreementStatus;

  // Blockchain fields
  @Column({ type: 'integer', nullable: true })
  blockchainLandId: number | null; // Land ID on blockchain (from smart contract)

  @Column({ type: 'varchar', length: 66, nullable: true })
  blockchainTxHash: string | null; // Transaction hash when land was registered on blockchain

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

  @ManyToOne(() => Project, (project) => project.lands, { nullable: true })
  @JoinColumn({ name: 'projectId' })
  project: Project | null;

  @OneToMany(() => Installment, (installment) => installment.land)
  installments: Installment[];

  // Additional relations for ownership tracking
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'originalOwnerId' })
  originalOwner: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'currentOwnerId' })
  currentOwner: User | null;
}
