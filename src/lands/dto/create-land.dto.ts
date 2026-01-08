import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
  IsNotEmpty,
  IsUUID,
  IsInt,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLandDto {
  @ApiProperty({
    description: 'Project ID (property must belong to a project)',
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  projectId: string;

  @ApiProperty({
    description: 'Land/Property title',
    example: 'Unit A-101',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description: 'Unit ID (unique identifier within project)',
    example: 'A-101',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  unitId?: string;

  @ApiProperty({
    description: 'Land location',
    example: '123 Ocean Drive, Miami',
    maxLength: 500,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  location: string;

  @ApiProperty({
    description: 'Land size in square meters',
    example: 500.5,
    minimum: 0.01,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  size: number;

  @ApiProperty({
    description: 'Land price',
    example: 250000.0,
    minimum: 0.01,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  price: number;

  @ApiProperty({
    description: 'Installment plan duration in years (2, 3, or 5)',
    example: 3,
    enum: [2, 3, 5],
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(5)
  installmentPlanYears?: number;

  @ApiProperty({
    description: 'Mark as resale property',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  isResale?: boolean;
}
