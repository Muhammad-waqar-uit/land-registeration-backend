import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TransferRequestStatus } from '../../entities/transfer-request.entity';

export class QueryTransferRequestsDto {
  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: TransferRequestStatus,
  })
  @IsOptional()
  @IsEnum(TransferRequestStatus)
  status?: TransferRequestStatus;

  @ApiPropertyOptional({
    description: 'Filter by property ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by current owner (seller) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  currentOwnerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by new owner (buyer) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  newOwnerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by resale request ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  resaleRequestId?: string;
}
