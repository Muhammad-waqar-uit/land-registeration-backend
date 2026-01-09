import {
  IsString,
  IsEmail,
  IsEnum,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../entities/user.entity';

export class RegisterDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'password123',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.USER,
  })
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;

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

  // Builder-specific fields (required when role is BUILDER)
  @ApiProperty({
    description: 'Company Name (required for builders)',
    example: 'ABC Construction Ltd.',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o: RegisterDto) => o.role === UserRole.BUILDER)
  @IsNotEmpty({ message: 'Company name is required for builders' })
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiProperty({
    description: 'License Number (required for builders, must be unique)',
    example: 'LIC-2024-001',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o: RegisterDto) => o.role === UserRole.BUILDER)
  @IsNotEmpty({ message: 'License number is required for builders' })
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;
}
