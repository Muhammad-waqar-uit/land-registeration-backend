import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterBuilderDto {
  @ApiProperty({
    description: 'Company Name',
    example: 'ABC Construction Ltd.',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Company name is required' })
  @IsString()
  @MaxLength(255)
  companyName: string;

  @ApiProperty({
    description: 'License Number (must be unique)',
    example: 'LIC-2024-001',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'License number is required' })
  @IsString()
  @MaxLength(100)
  licenseNumber: string;

  @ApiProperty({
    description: 'CNIC Number',
    example: '12345-1234567-1',
    required: false,
  })
  @IsOptional()
  @IsString()
  cnic?: string;

  @ApiProperty({
    description: 'Phone Number',
    example: '+923001234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
