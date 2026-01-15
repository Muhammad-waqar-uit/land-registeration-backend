import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ProjectStatus } from '../../entities/project.entity';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'Luxury Apartments Phase 1',
    maxLength: 255,
  })
  @Transform(({ value }): string | null | undefined => {
    if (value === null || value === undefined) return value;
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @IsNotEmpty({ message: 'Project name is required' })
  @IsString({ message: 'Project name must be a string' })
  @MaxLength(255, {
    message: 'Project name must be shorter than or equal to 255 characters',
  })
  name: string;

  @ApiProperty({
    description: 'Project description',
    example: 'Modern luxury apartments with world-class amenities',
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Project location',
    example: 'Downtown Area, City',
    maxLength: 255,
  })
  @Transform(({ value }): string | null | undefined => {
    if (value === null || value === undefined) return value;
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @IsNotEmpty({ message: 'Project location is required' })
  @IsString({ message: 'Project location must be a string' })
  @MaxLength(255, {
    message: 'Project location must be shorter than or equal to 255 characters',
  })
  location: string;

  @ApiProperty({
    description: 'Detailed location information',
    example: 'Near Central Park, next to shopping mall, 5 minutes from airport',
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @IsOptional()
  @IsString()
  locationDetails?: string;

  @ApiProperty({
    description: 'Total number of units in the project',
    example: 50,
    required: false,
    default: 0,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const num = typeof value === 'string' ? parseInt(value, 10) : Number(value);
    return isNaN(num) ? undefined : num;
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Total units must be a number' })
  @IsInt({ message: 'Total units must be an integer' })
  @Min(0, { message: 'Total units must be greater than or equal to 0' })
  totalUnits?: number;

  @ApiProperty({
    description: 'Project status',
    enum: ProjectStatus,
    example: ProjectStatus.DRAFT,
    required: false,
    default: ProjectStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ProjectStatus, {
    message: 'Status must be one of: draft, active, completed, cancelled',
  })
  status?: ProjectStatus;
}
