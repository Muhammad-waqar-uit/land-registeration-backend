import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty({
    description: 'Whether the balance query succeeded',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Points balance for the wallet (as string)',
    example: '1000',
    required: false,
  })
  balance?: string;

  @ApiProperty({
    description: 'Error message if any',
    required: false,
  })
  error?: string;
}

