import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TokenRequestStatus } from '../../entities/token-request.entity';

export class QueryTokenRequestsDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by request status',
    enum: TokenRequestStatus,
    example: TokenRequestStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(TokenRequestStatus)
  status?: TokenRequestStatus;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
