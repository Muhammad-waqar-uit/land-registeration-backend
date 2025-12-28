import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({
    description: 'Refresh token to invalidate (optional)',
    example: 'refresh-token-abc123xyz...',
    required: false,
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

