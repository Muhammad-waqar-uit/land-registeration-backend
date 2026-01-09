import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private masterWallet: ethers.HDNodeWallet | null = null;
  private readonly masterMnemonic: string;

  constructor(private configService: ConfigService) {
    // Get master mnemonic from environment or generate one
    const envMnemonic = this.configService.get<string>(
      'MASTER_WALLET_MNEMONIC',
    );

    if (envMnemonic) {
      this.masterMnemonic = envMnemonic;
    } else {
      this.masterMnemonic = this.generateMasterMnemonic();
    }

    this.initializeMasterWallet();
  }

  /**
   * Initialize master wallet from mnemonic
   */
  private initializeMasterWallet(): void {
    try {
      // Create HD wallet from mnemonic
      this.masterWallet = ethers.HDNodeWallet.fromPhrase(this.masterMnemonic);
      this.logger.log('Master wallet initialized');
      this.logger.log(`Master address: ${this.masterWallet.address}`);
    } catch (error) {
      this.logger.error('Failed to initialize master wallet:', error);
      throw new Error('Failed to initialize wallet service');
    }
  }

  /**
   * Generate a unique wallet address for a user
   * Uses HD wallet derivation: m/44'/60'/0'/0/{userIdIndex}
   * @param userIdIndex - Unique index for the user (can be user ID hash or sequential)
   * @returns Wallet address and derivation path
   */
  generateUserWallet(userIdIndex: number): {
    address: string;
    derivationPath: string;
  } {
    try {
      if (!this.masterWallet) {
        throw new Error('Master wallet not initialized');
      }

      // Derive wallet using BIP44 path: m/44'/60'/0'/0/{index}
      // 44' = BIP44, 60' = Ethereum, 0' = account, 0 = change, {index} = address index
      const derivationPath = `m/44'/60'/0'/0/${userIdIndex}`;

      // Derive step by step from master wallet
      // First derive to the account level: m/44'/60'/0'
      const accountWallet = this.masterWallet.derivePath(`44'/60'/0'`);
      // Then derive to change level: 0
      const changeWallet = accountWallet.derivePath('0');
      // Finally derive to the specific address index
      const derivedWallet = changeWallet.derivePath(userIdIndex.toString());
      const address = derivedWallet.address;

      this.logger.log(
        `Generated wallet for user index ${userIdIndex}: ${address}`,
      );

      return {
        address,
        derivationPath,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate wallet for user ${userIdIndex}:`,
        error,
      );
      throw new Error('Failed to generate user wallet');
    }
  }

  /**
   * Generate wallet address from user ID (UUID)
   * Converts UUID to a numeric index for derivation
   */
  generateWalletFromUserId(userId: string): {
    address: string;
    derivationPath: string;
  } {
    // Convert UUID to a numeric index (using first 8 characters as hex, then to number)
    // This ensures consistent derivation for the same user ID
    const userIdHash = userId.replace(/-/g, '');
    const numericIndex = parseInt(userIdHash.substring(0, 8), 16) % 2147483647; // Max safe integer for BIP44

    return this.generateUserWallet(numericIndex);
  }

  /**
   * Get master wallet address
   */
  getMasterAddress(): string {
    if (!this.masterWallet) {
      throw new Error('Master wallet not initialized');
    }
    return this.masterWallet.address;
  }

  /**
   * Generate a new master mnemonic (for initial setup)
   * WARNING: Only use this for initial setup. Store the mnemonic securely!
   */
  private generateMasterMnemonic(): string {
    const mnemonic = ethers.Wallet.createRandom().mnemonic?.phrase;
    if (!mnemonic) {
      throw new Error('Failed to generate mnemonic');
    }

    this.logger.warn('⚠️  NEW MASTER MNEMONIC GENERATED');
    this.logger.warn(
      '⚠️  Store this mnemonic securely in your .env file as MASTER_WALLET_MNEMONIC',
    );
    this.logger.warn(`⚠️  Mnemonic: ${mnemonic}`);
    this.logger.warn(
      '⚠️  If you lose this mnemonic, you cannot recover user wallets!',
    );

    return mnemonic;
  }

  /**
   * Verify wallet address format
   */
  isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Get private key from user ID
   * @param userId - User ID (UUID)
   * @returns Private key (for signing transactions)
   *
   * @dev SECURITY WARNING:
   *      - Private keys should be handled securely
   *      - Only use for backend-managed transactions
   *      - Never expose private keys to frontend or logs
   *      - Store securely and never commit to version control
   */
  getPrivateKeyFromUserId(userId: string): string {
    if (!this.masterWallet) {
      throw new Error('Master wallet not initialized');
    }

    try {
      // Derive wallet using the same logic as generateWalletFromUserId
      const userIdHash = userId.replace(/-/g, '');
      const numericIndex =
        parseInt(userIdHash.substring(0, 8), 16) % 2147483647; // Max safe integer for BIP44

      // Derive step by step from master wallet
      const accountWallet = this.masterWallet.derivePath(`44'/60'/0'`);
      const changeWallet = accountWallet.derivePath('0');
      const derivedWallet = changeWallet.derivePath(numericIndex.toString());

      this.logger.log(
        `Retrieved private key for user ${userId} (address: ${derivedWallet.address})`,
      );

      return derivedWallet.privateKey;
    } catch (error) {
      this.logger.error(`Failed to get private key for user ${userId}:`, error);
      throw new Error('Failed to get user private key');
    }
  }

  /**
   * Get private key from wallet address (requires user ID lookup)
   * @param walletAddress - User's wallet address
   * @param userId - User ID (required to derive private key)
   * @returns Private key
   *
   * @dev NOTE: This method requires userId because we need to know the derivation path.
   *      If you only have the address, you'll need to look up the userId first.
   */
  getPrivateKeyFromAddress(walletAddress: string, userId: string): string {
    // First verify the address matches
    const privateKey = this.getPrivateKeyFromUserId(userId);
    const derivedWallet = new ethers.Wallet(privateKey);

    if (derivedWallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error(
        `Wallet address mismatch. Expected ${walletAddress}, got ${derivedWallet.address}`,
      );
    }

    return privateKey;
  }
}
