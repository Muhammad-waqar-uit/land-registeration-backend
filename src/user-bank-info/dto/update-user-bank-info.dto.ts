import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserBankInfoDto {
  @ApiPropertyOptional({ description: 'Bank name', example: 'HBL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;

  @ApiPropertyOptional({ description: 'Account number', example: '12345678901234' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  accountNumber?: string;
}
