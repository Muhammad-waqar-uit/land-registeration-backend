import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

export interface TransactionVerification {
  confirmed: boolean;
  status: number; // 1 = success, 0 = failed
  blockNumber?: number;
  confirmations?: number;
  error?: string;
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.Provider | null = null;

  constructor(private configService: ConfigService) {
    this.initializeProvider();
  }

  /**
   * Initialize blockchain provider from RPC URL
   */
  private initializeProvider(): void {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');

    if (!rpcUrl) {
      this.logger.warn(
        'BLOCKCHAIN_RPC_URL not configured. Crypto payment auto-verification will be disabled.',
      );
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.logger.log('Blockchain provider initialized');
    } catch (error) {
      this.logger.error('Failed to initialize blockchain provider:', error);
    }
  }

  /**
   * Verify a blockchain transaction
   * @param transactionHash - The transaction hash to verify
   * @param minConfirmations - Minimum number of confirmations required (default: 3)
   * @returns Transaction verification result
   */
  async verifyTransaction(
    transactionHash: string,
    minConfirmations: number = 3,
  ): Promise<TransactionVerification> {
    if (!this.provider) {
      return {
        confirmed: false,
        status: 0,
        error: 'Blockchain provider not configured',
      };
    }

    try {
      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        // Transaction not found or not yet mined
        return {
          confirmed: false,
          status: 0,
          error: 'Transaction not found or pending',
        };
      }

      // Get current block number to calculate confirmations
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      // Check if transaction succeeded (status === 1 means success)
      const transactionSucceeded = receipt.status === 1;

      // Check if we have enough confirmations
      const hasEnoughConfirmations = confirmations >= minConfirmations;

      return {
        confirmed: hasEnoughConfirmations && transactionSucceeded,
        status: receipt.status || 0,
        blockNumber: receipt.blockNumber,
        confirmations,
      };
    } catch (error) {
      this.logger.error(
        `Error verifying transaction ${transactionHash}:`,
        error,
      );
      return {
        confirmed: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if blockchain service is available
   */
  isAvailable(): boolean {
    return this.provider !== null;
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    if (!this.provider) {
      return null;
    }

    try {
      return await this.provider.getTransaction(txHash);
    } catch (error) {
      this.logger.error(`Error getting transaction ${txHash}:`, error);
      return null;
    }
  }
}
