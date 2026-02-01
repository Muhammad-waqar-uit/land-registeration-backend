import { ApiProperty } from '@nestjs/swagger';
import { BuyerProgressStatus } from './query-buyer-progress.dto';

export class BuyerProgressItemDto {
  @ApiProperty({ description: 'Buyer ID', example: 'uuid' })
  buyerId: string;

  @ApiProperty({ description: "Buyer's full name", example: 'John Doe' })
  buyerName: string;

  @ApiProperty({ description: "Buyer's email", example: 'john@example.com' })
  buyerEmail: string;

  @ApiProperty({
    description: "Buyer's phone number",
    example: '+1234567890',
    nullable: true,
  })
  buyerPhone: string | null;

  @ApiProperty({ description: 'Property/Land ID', example: 'uuid' })
  landId: string;

  @ApiProperty({
    description: 'Property title',
    example: 'Beachfront Property Unit A-101',
  })
  landTitle: string;

  @ApiProperty({
    description: 'Property location',
    example: '123 Ocean Drive, Miami, FL',
  })
  landLocation: string;

  @ApiProperty({ description: 'Total property price', example: 250000.0 })
  landPrice: number;

  @ApiProperty({
    description: 'Project ID if property belongs to a project',
    example: 'uuid',
    nullable: true,
  })
  projectId: string | null;

  @ApiProperty({
    description: 'Project name for display',
    example: 'Ocean View Residency',
    nullable: true,
  })
  projectName: string | null;

  @ApiProperty({
    description: 'Total amount paid (verified payments only)',
    example: 100000.0,
  })
  totalPaid: number;

  @ApiProperty({
    description: 'Remaining balance to be paid',
    example: 150000.0,
  })
  remainingBalance: number;

  @ApiProperty({
    description: 'Count of pending payments',
    example: 2,
  })
  pendingPayments: number;

  @ApiProperty({
    description: 'Count of verified payments',
    example: 3,
  })
  verifiedPayments: number;

  @ApiProperty({
    description: 'Date of last verified payment',
    example: '2024-01-20T10:00:00.000Z',
    nullable: true,
  })
  lastPaymentDate: Date | null;

  @ApiProperty({
    description: 'Amount of last verified payment',
    example: 50000.0,
    nullable: true,
  })
  lastPaymentAmount: number | null;

  @ApiProperty({
    description: 'Buyer progress status',
    enum: BuyerProgressStatus,
    example: BuyerProgressStatus.PAYING,
  })
  status: BuyerProgressStatus;

  @ApiProperty({
    description: 'Agreement ID if agreement exists',
    example: 'uuid',
    nullable: true,
  })
  agreementId: string | null;

  @ApiProperty({
    description: 'Agreement status if agreement exists',
    example: 'signed',
    nullable: true,
  })
  agreementStatus: string | null;

  @ApiProperty({
    description: 'Date when property was reserved',
    example: '2024-01-15T10:00:00.000Z',
    nullable: true,
  })
  reservationDate: Date | null;

  @ApiProperty({
    description: 'When this progress record was created',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When this progress record was last updated',
    example: '2024-01-20T10:00:00.000Z',
  })
  updatedAt: Date;
}

export class BuyerProgressStatsDto {
  @ApiProperty({ description: 'Total number of unique buyers', example: 10 })
  totalBuyers: number;

  @ApiProperty({
    description: 'Count of buyers with status reserved',
    example: 3,
  })
  reserved: number;

  @ApiProperty({
    description: 'Count of buyers with status paying',
    example: 5,
  })
  inProgress: number;

  @ApiProperty({
    description: 'Count of buyers with status completed',
    example: 2,
  })
  completed: number;

  @ApiProperty({
    description: 'Total verified payments received',
    example: 500000.0,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Total pending payments amount',
    example: 200000.0,
  })
  pendingRevenue: number;

  @ApiProperty({
    description: 'Per-status statistics',
    type: 'object',
    additionalProperties: true,
    example: {
      reserved: { count: 5, revenue: 0.0 },
      paying: { count: 12, revenue: 500000.0 },
      completed: { count: 3, revenue: 750000.0 },
    },
  })
  byStatus: {
    reserved: { count: number; revenue: number };
    paying: { count: number; revenue: number };
    completed: { count: number; revenue: number };
  };

  @ApiProperty({
    description: 'Per-project statistics',
    type: 'object',
    additionalProperties: true,
    example: {
      'proj-001': {
        projectName: 'Ocean View Residency',
        totalBuyers: 8,
        reserved: 2,
        inProgress: 5,
        completed: 1,
        totalRevenue: 200000.0,
        pendingRevenue: 300000.0,
      },
    },
  })
  byProject: Record<
    string,
    {
      projectName: string;
      totalBuyers: number;
      reserved: number;
      inProgress: number;
      completed: number;
      totalRevenue: number;
      pendingRevenue: number;
    }
  >;
}

export class BuyerProgressResponseDto {
  @ApiProperty({
    description: 'List of buyer progress items',
    type: [BuyerProgressItemDto],
  })
  data: BuyerProgressItemDto[];

  @ApiProperty({ description: 'Total number of records', example: 10 })
  total: number;

  @ApiProperty({
    description: 'Summary statistics',
    type: BuyerProgressStatsDto,
  })
  stats: BuyerProgressStatsDto;
}
