import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTokenRequestDto {
  @ApiProperty({
    description: 'Amount of points requested (ledger points)',
    example: 1000.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Notes or reason for the points request',
    example: 'Need points for property purchase payment',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Screenshot/proof URL (uploaded to storage)',
    example: 'https://storage.example.com/screenshots/proof123.png',
  })
  @IsOptional()
  @IsString()
  screenshotUrl?: string;
}
