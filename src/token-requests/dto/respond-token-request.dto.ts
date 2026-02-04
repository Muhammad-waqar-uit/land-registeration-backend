import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TokenRequestStatus } from '../../entities/token-request.entity';

export class RespondTokenRequestDto {
  @ApiProperty({
    description: 'Admin decision - approve or reject',
    enum: TokenRequestStatus,
    example: TokenRequestStatus.APPROVED,
  })
  @IsEnum(TokenRequestStatus, {
    message: 'Status must be either approved or rejected',
  })
  status: TokenRequestStatus.APPROVED | TokenRequestStatus.REJECTED;

  @ApiPropertyOptional({
    description: "Admin's response or notes",
    example: 'Request approved. Tokens transferred to your wallet.',
  })
  @IsOptional()
  @IsString()
  adminResponse?: string;
}
