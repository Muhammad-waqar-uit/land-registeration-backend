import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLandDto {
  @ApiProperty({
    description: 'Land title',
    example: 'Beachfront Property',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

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
    description: 'Document hash (optional)',
    example: 'abc123',
    required: false,
  })
  @IsOptional()
  @IsString()
  documentHash?: string;
}
