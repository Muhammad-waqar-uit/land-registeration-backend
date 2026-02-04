import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TokenRequest,
  TokenRequestStatus,
} from '../../entities/token-request.entity';

export class TokenRequestResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  userId: string;

  @ApiProperty({ example: 1000.0 })
  amount: number;

  @ApiPropertyOptional({
    example: 'Need tokens for property purchase payment',
  })
  notes: string | null;

  @ApiPropertyOptional({
    example: 'https://storage.example.com/screenshots/proof123.png',
  })
  screenshotUrl: string | null;

  @ApiProperty({
    enum: TokenRequestStatus,
    example: TokenRequestStatus.PENDING,
  })
  status: TokenRequestStatus;

  @ApiPropertyOptional({
    example: 'Request approved. Tokens transferred to your wallet.',
  })
  adminResponse: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  reviewedBy: string | null;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00Z' })
  reviewedAt: Date | null;

  @ApiProperty({ example: '2024-01-15T09:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'User who made the request',
  })
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    walletAddress: string | null;
  };

  @ApiPropertyOptional({
    description: 'Admin who reviewed the request',
  })
  reviewer?: {
    id: string;
    name: string;
    email: string;
  } | null;

  static fromEntity(
    tokenRequest: TokenRequest & { user?: any; reviewer?: any },
  ): TokenRequestResponseDto {
    const dto = new TokenRequestResponseDto();
    dto.id = tokenRequest.id;
    dto.userId = tokenRequest.userId;
    dto.amount = Number(tokenRequest.amount);
    dto.notes = tokenRequest.notes;
    dto.screenshotUrl = tokenRequest.screenshotUrl;
    dto.status = tokenRequest.status;
    dto.adminResponse = tokenRequest.adminResponse;
    dto.reviewedBy = tokenRequest.reviewedBy;
    dto.reviewedAt = tokenRequest.reviewedAt;
    dto.createdAt = tokenRequest.createdAt;
    dto.updatedAt = tokenRequest.updatedAt;

    if (tokenRequest.user) {
      dto.user = {
        id: tokenRequest.user.id,
        name: tokenRequest.user.name,
        email: tokenRequest.user.email,
        role: tokenRequest.user.role,
        walletAddress: tokenRequest.user.walletAddress || null,
      };
    }

    if (tokenRequest.reviewer) {
      dto.reviewer = {
        id: tokenRequest.reviewer.id,
        name: tokenRequest.reviewer.name,
        email: tokenRequest.reviewer.email,
      };
    }

    return dto;
  }
}
