import { IsOptional, IsEnum, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { LandStatus } from '../../entities/land.entity';

export class QueryLandsDto {
  @ApiProperty({
    description: 'Filter by land status',
    enum: LandStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(LandStatus)
  status?: LandStatus;

  @ApiProperty({
    description: 'Filter by owner ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiProperty({
    description: 'Minimum price filter',
    example: 10000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiProperty({
    description: 'Maximum price filter',
    example: 500000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

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
