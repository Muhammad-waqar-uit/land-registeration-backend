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
import { Land } from './land.entity';

export enum ProjectStatus {
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255 })
  location: string;

  @Column({ type: 'text', nullable: true })
  locationDetails: string | null;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.PENDING_APPROVAL,
  })
  status: ProjectStatus;

  @Column({ type: 'int', default: 0 })
  totalUnits: number;

  @Column({ type: 'int', default: 0 })
  soldUnits: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  approvalDocumentsCID: string | null;

  @Column({ type: 'text', nullable: true })
  approvalDocumentsIPFSHash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  approvalDocumentsHash: string | null; // SHA-256 hash for tamper detection

  @Column({ type: 'uuid' })
  builderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'builderId' })
  builder: User;

  @OneToMany(() => Land, (land) => land.project)
  lands: Land[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
