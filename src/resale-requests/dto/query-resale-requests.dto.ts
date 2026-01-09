import { IsOptional, IsEnum, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ResaleRequestStatus } from '../../entities/resale-request.entity';

export class QueryResaleRequestsDto {
  @ApiProperty({
    description: 'Filter by request status',
    enum: ResaleRequestStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ResaleRequestStatus)
  status?: ResaleRequestStatus;

  @ApiProperty({
    description: 'Filter by property ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiProperty({
    description: 'Filter by current owner ID (seller)',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  currentOwnerId?: string;

  @ApiProperty({
    description: 'Filter by builder ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  builderId?: string;

  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
    required: false,
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
