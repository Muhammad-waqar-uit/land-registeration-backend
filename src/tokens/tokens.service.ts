import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../common/services/blockchain.service';
import { MintTokenDto } from './dto/mint-token.dto';
import { MintTokenResponseDto } from './dto/mint-response.dto';

@Injectable()
export class TokensService {
  constructor(private readonly blockchainService: BlockchainService) {}

  async mintToken(mintTokenDto: MintTokenDto): Promise<MintTokenResponseDto> {
    // Convert decimal amount to bigint with proper 18 decimal precision
    // Convert the decimal amount to a string and handle it properly
    const amountString = mintTokenDto.amount.toString();
    const [integerPart, decimalPart = ''] = amountString.split('.');
    const decimals = 18;
    const decimalPadded = decimalPart.padEnd(decimals, '0').slice(0, decimals);
    const amountWithDecimals = BigInt(integerPart + decimalPadded);

    const result = await this.blockchainService.mintToken(
      mintTokenDto.toAddress,
      amountWithDecimals,
    );

    return {
      success: result.success,
      transactionHash: result.transactionHash,
      error: result.error,
    };
  }
}
