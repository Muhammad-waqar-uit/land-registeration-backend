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

@Entity('installment_plans')
export class InstallmentPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  builderId: string; // FK to User (builder)

  @Column({ type: 'varchar', length: 255 })
  name: string; // e.g., "5 Year Plan", "3 Year Flexi Plan"

  @Column({ type: 'int' })
  durationYears: number; // 2, 3, or 5 years

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalAmount: number | null; // Total amount for the plan (nullable - can be per property)

  // Optional payment milestones (stored as JSON)
  // Example: [{ milestone: "25%", amount: 250000, dueDate: null }, ...]
  @Column({ type: 'jsonb', nullable: true })
  milestones: {
    milestone?: string; // e.g., "25%", "50%", "Final Payment"
    percentage?: number; // Percentage of total amount
    amount?: number; // Specific amount
    description?: string; // Description of milestone
    suggestedDueDate?: string; // Suggested date (not enforced in timeline-based system)
    [key: string]: any;
  }[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'builderId' })
  builder: User;
}

