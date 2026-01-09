import {
  IsOptional,
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'User email',
    example: 'john@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'CNIC Number',
    example: '12345-1234567-1',
    required: false,
  })
  @IsOptional()
  @IsString()
  cnic?: string;

  @ApiProperty({
    description: 'Father Name',
    example: 'Jane Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  fatherName?: string;

  @ApiProperty({
    description: 'Phone Number',
    example: '+923001234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  // Builder-specific fields
  @ApiProperty({
    description: 'Company Name (for builders)',
    example: 'ABC Construction Ltd.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiProperty({
    description: 'License Number (for builders, must be unique)',
    example: 'LIC-2024-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;
}
