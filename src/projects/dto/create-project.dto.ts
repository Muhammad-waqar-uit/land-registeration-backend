import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'Luxury Apartments Phase 1',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

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
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  location: string;

  @ApiProperty({
    description: 'Detailed location information',
    example: 'Near Central Park, next to shopping mall, 5 minutes from airport',
    required: false,
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
  @IsOptional()
  totalUnits?: number;
}

