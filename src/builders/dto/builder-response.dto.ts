import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole } from '../../entities/user.entity';

export class BuilderResponseDto {
  @ApiProperty({ description: 'User ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'User name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'User email', example: 'john@example.com' })
  email: string;

  @ApiProperty({ description: 'User role', enum: UserRole, example: UserRole.BUILDER })
  role: UserRole;

  @ApiProperty({
    description: 'User wallet address (Ethereum-compatible)',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    nullable: true,
  })
  walletAddress: string | null;

  @ApiProperty({ description: 'CNIC number', nullable: true })
  cnic: string | null;

  @ApiProperty({ description: 'Father name', nullable: true })
  fatherName: string | null;

  @ApiProperty({ description: 'Phone number', nullable: true })
  phoneNumber: string | null;

  @ApiProperty({ description: 'Is builder verified', example: false })
  isBuilderVerified: boolean;

  @ApiProperty({ description: 'Builder verification date', nullable: true })
  builderVerifiedAt: Date | null;

  @ApiProperty({ description: 'Company name', nullable: true })
  companyName: string | null;

  @ApiProperty({ description: 'License number', nullable: true })
  licenseNumber: string | null;

  @ApiProperty({ description: 'ID of admin who verified', nullable: true })
  verifiedBy: string | null;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  static fromEntity(user: User): BuilderResponseDto {
    const {
      password,
      ownedLands,
      payments,
      reservations,
      verifier,
      ...builderResponse
    } = user;
    return builderResponse;
  }
}

