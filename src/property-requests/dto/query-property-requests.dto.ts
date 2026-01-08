import { IsOptional, IsEnum, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PropertyRequestStatus } from '../../entities/property-request.entity';

export class QueryPropertyRequestsDto {
  @ApiProperty({
    description: 'Filter by request status',
    enum: PropertyRequestStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(PropertyRequestStatus)
  status?: PropertyRequestStatus;

  @ApiProperty({
    description: 'Filter by property ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiProperty({
    description: 'Filter by buyer ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  buyerId?: string;

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

