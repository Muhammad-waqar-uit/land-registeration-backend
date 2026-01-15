import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole } from '../../entities/user.entity';

export class UserDetailResponseDto {
  @ApiProperty({ description: 'User ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'User name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'User email', example: 'john@example.com' })
  email: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.USER,
  })
  role: UserRole;

  @ApiProperty({
    description: 'User wallet address (Ethereum-compatible)',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    nullable: true,
  })
  walletAddress: string | null;

  @ApiProperty({
    description: 'CNIC (Computerized National Identity Card)',
    example: '12345-1234567-1',
    nullable: true,
  })
  cnic: string | null;

  @ApiProperty({
    description: 'Father name',
    example: 'Father Name',
    nullable: true,
  })
  fatherName: string | null;

  @ApiProperty({
    description: 'Phone number',
    example: '+923001234567',
    nullable: true,
  })
  phoneNumber: string | null;

  @ApiProperty({
    description: 'Whether builder is verified',
    example: false,
    default: false,
  })
  isBuilderVerified: boolean;

  @ApiProperty({
    description: 'Builder verification date',
    nullable: true,
  })
  builderVerifiedAt: Date | null;

  @ApiProperty({
    description: 'Company name (for builders)',
    example: 'ABC Construction',
    nullable: true,
  })
  companyName: string | null;

  @ApiProperty({
    description: 'License number (for builders)',
    example: 'LIC-12345',
    nullable: true,
  })
  licenseNumber: string | null;

  @ApiProperty({
    description: 'ID of admin who verified the builder',
    example: 'uuid',
    nullable: true,
  })
  verifiedBy: string | null;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  static fromEntity(user: User): UserDetailResponseDto {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userResponse } = user;
    return userResponse;
  }
}
