import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole } from '../../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'User name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'User email', example: 'john@example.com' })
  email: string;

  @ApiProperty({ description: 'User role', enum: UserRole, example: UserRole.BUYER })
  role: UserRole;

  @ApiProperty({
    description: 'User wallet address (Ethereum-compatible)',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    nullable: true,
  })
  walletAddress: string | null;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const { password, ...userResponse } = user;
    return userResponse;
  }
}

export class AuthResponseDto {
  @ApiProperty({ description: 'User information', type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ description: 'JWT access token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;
}
