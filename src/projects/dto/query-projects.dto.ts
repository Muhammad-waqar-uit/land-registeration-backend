import { IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus } from '../../entities/project.entity';

export class QueryProjectsDto {
  @ApiProperty({
    description: 'Filter by project status',
    enum: ProjectStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiProperty({
    description: 'Filter by builder ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  builderId?: string;

  @ApiProperty({
    description: 'Search by project name or location',
    example: 'Luxury',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
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
  limit?: number = 10;
}
