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
import { OwnershipDocumentFile } from './ownership-document-file.entity';

export enum OwnershipDocumentType {
    INITIAL_OWNERSHIP = 'initial_ownership',
    FINAL_OWNERSHIP = 'final_ownership',
}

export enum OwnershipDocumentStatus {
    PENDING_ADMIN_APPROVAL = 'pending_admin_approval',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

@Entity('ownership_documents')
export class OwnershipDocument {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    landId: string; // FK to Land/Property

    @Column({ type: 'uuid' })
    uploaderId: string; // FK to User (builder who uploaded)

    @Column({ type: 'uuid' })
    buyerId: string; // FK to User (buyer/new owner)

    @Column({
        type: 'enum',
        enum: OwnershipDocumentType,
        default: OwnershipDocumentType.INITIAL_OWNERSHIP,
    })
    documentType: OwnershipDocumentType;

    @Column({
        type: 'enum',
        enum: OwnershipDocumentStatus,
        default: OwnershipDocumentStatus.PENDING_ADMIN_APPROVAL,
    })
    status: OwnershipDocumentStatus;

    // Admin review fields
    @Column({ type: 'uuid', nullable: true })
    reviewedBy: string | null; // FK to User (admin who reviewed)

    @Column({ type: 'timestamp', nullable: true })
    reviewedAt: Date | null;

    @Column({ type: 'text', nullable: true })
    adminNotes: string | null; // Admin's notes during review

    @Column({ type: 'text', nullable: true })
    rejectionReason: string | null; // Reason if rejected

    // Uploader metadata
    @Column({ type: 'text', nullable: true })
    notes: string | null; // Builder's notes when uploading

    @Column({ type: 'timestamp' })
    uploadedAt: Date; // When documents were uploaded

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Land, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'landId' })
    property: Land;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'uploaderId' })
    uploader: User; // Builder

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'buyerId' })
    buyer: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'reviewedBy' })
    reviewer: User | null; // Admin

    @OneToMany(() => OwnershipDocumentFile, (file) => file.ownershipDocument, {
        cascade: true,
    })
    documents: OwnershipDocumentFile[];
}
