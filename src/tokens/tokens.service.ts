import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../common/services/blockchain.service';
import { MintTokenDto } from './dto/mint-token.dto';
import { MintTokenResponseDto } from './dto/mint-response.dto';
import { GetBalanceDto } from './dto/get-balance.dto';
import { BalanceResponseDto } from './dto/balance-response.dto';

@Injectable()
export class TokensService {
  constructor(private readonly blockchainService: BlockchainService) {}

  async getBalance(getBalanceDto: GetBalanceDto): Promise<BalanceResponseDto> {
    const result = await this.blockchainService.ledgerGetBalance(
      getBalanceDto.address,
    );

    return {
      success: result.success,
      balance: result.balance,
      error: result.error,
    };
  }

  async mintToken(mintTokenDto: MintTokenDto): Promise<MintTokenResponseDto> {
    // Award points via LandLedgerLite (ledger only).
    const amountString = mintTokenDto.amount.toString();
    const [integerPart, decimalPart = ''] = amountString.split('.');
    const decimals = 18;
    const decimalPadded = decimalPart.padEnd(decimals, '0').slice(0, decimals);
    const amountWithDecimals = BigInt(integerPart + decimalPadded);

    const result = await this.blockchainService.ledgerAwardPoints(
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
