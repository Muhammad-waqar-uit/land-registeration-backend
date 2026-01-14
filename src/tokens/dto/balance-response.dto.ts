import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Token balance in human-readable format (with decimals)',
    example: '1000.5',
  })
  balance?: string;

  @ApiProperty({
    description: 'Raw balance from blockchain (in smallest unit)',
    example: '1000500000000000000000',
  })
  balanceRaw?: string;

  @ApiProperty({
    description: 'Token decimals',
    example: 18,
  })
  decimals?: number;

  @ApiProperty({
    description: 'Error message if operation failed',
    example: null,
    required: false,
  })
  error?: string;
}
