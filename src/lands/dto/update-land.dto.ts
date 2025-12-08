import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LandStatus } from '../../entities/land.entity';

export class UpdateLandDto {
  @ApiProperty({ description: 'Land title', example: 'Updated Title', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({ description: 'Land location', example: '123 Ocean Drive, Miami', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiProperty({ description: 'Land size in square meters', example: 500.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  size?: number;

  @ApiProperty({ description: 'Land price', example: 275000.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @ApiProperty({ description: 'Land status', enum: LandStatus, required: false })
  @IsOptional()
  @IsEnum(LandStatus)
  status?: LandStatus;

  @ApiProperty({ description: 'Document hash', example: 'abc123', required: false })
  @IsOptional()
  @IsString()
  documentHash?: string;
}
