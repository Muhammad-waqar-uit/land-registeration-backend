import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus } from '../../entities/project.entity';

export class UpdateProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'Luxury Apartments Phase 1',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'Project description',
    example: 'Modern luxury apartments with world-class amenities',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Project location',
    example: 'Downtown Area, City',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiProperty({
    description: 'Detailed location information',
    example: 'Near Central Park, next to shopping mall',
    required: false,
  })
  @IsOptional()
  @IsString()
  locationDetails?: string;

  @ApiProperty({
    description: 'Project status',
    enum: ProjectStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiProperty({
    description: 'Total number of units',
    example: 50,
    required: false,
  })
  @IsOptional()
  totalUnits?: number;
}
