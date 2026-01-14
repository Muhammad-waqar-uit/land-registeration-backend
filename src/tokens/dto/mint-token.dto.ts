import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min, Matches } from 'class-validator';

export class MintTokenDto {
  @ApiProperty({
    description: 'Recipient wallet address to mint tokens to',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message:
      'Address must be a valid Ethereum address (0x followed by 40 hex characters)',
  })
  toAddress: string;

  @ApiProperty({
    description: 'Amount of tokens to mint (in token units, not wei)',
    example: 1000,
    minimum: 0.000001,
  })
  @IsNumber()
  @Min(0.000001, { message: 'Amount must be greater than 0' })
  amount: number;
}
