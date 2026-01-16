import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum BuyerProgressStatus {
  RESERVED = 'reserved',
  PAYING = 'paying',
  COMPLETED = 'completed',
}

export class QueryBuyerProgressDto {
  @ApiProperty({
    description: 'Filter by buyer progress status',
    enum: BuyerProgressStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(BuyerProgressStatus)
  status?: BuyerProgressStatus;

  @ApiProperty({
    description: 'Filter by specific property/land ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  landId?: string;

  @ApiProperty({
    description: 'Filter by specific buyer ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @ApiProperty({
    description: 'Filter by specific project ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
