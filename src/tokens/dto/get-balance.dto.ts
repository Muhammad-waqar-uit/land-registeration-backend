import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class GetBalanceDto {
  @ApiProperty({
    description: 'User wallet address to check balance for',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message:
      'Address must be a valid Ethereum address (0x followed by 40 hex characters)',
  })
  address: string;
}
