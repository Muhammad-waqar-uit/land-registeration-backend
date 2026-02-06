import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsString } from 'class-validator';

export class GetBalanceDto {
  @ApiProperty({
    description: 'Wallet address to check points balance for',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsString()
  @IsEthereumAddress()
  address: string;
}

