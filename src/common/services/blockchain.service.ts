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

export interface RegisterLandResult {
  success: boolean;
  landId?: number; // Blockchain land ID
  transactionHash?: string;
  error?: string;
}

export interface LockLandResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export interface UpdateLandResult {
  success: boolean;
  transactionHash?: string;
  requiresSellerApproval?: boolean;
  error?: string;
}

export interface ApproveTokenResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export interface MakePaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

// Smart Contract ABI (updated for admin-only, address-parameter functions)
const LAND_REGISTRY_ABI = [
  'function registerLand(address _owner, string memory _ipfsHash, bytes32 _documentHash, uint256 _totalPrice) external',
  'function lockLandToBuyer(uint256 landId, address buyer) external',
  'function updateLand(uint256 landId, string memory _ipfsHash, bytes32 _documentHash, uint256 _totalPrice) external',
  'function sellerApproveUpdate(uint256 landId, address seller) external',
  'function sellerRevokeUpdateApproval(uint256 landId, address seller) external',
  'function makePayment(uint256 landId, address buyer, uint256 amount) external',
  'function submitBankPayment(uint256 landId, address buyer, uint256 amount, string memory proofHash) external',
  'function verifyBankPayment(uint256 landId, bool approved) external',
  'function sellerApproveTransfer(uint256 landId, address seller) external',
  'function sellerRevokeApproval(uint256 landId, address seller) external',
  'function requestRefund(uint256 landId, address buyer) external',
  'function adminUnlockLand(uint256 landId) external',
  'function getPaymentBreakdown(uint256 landId) view returns (uint256 totalPaid, uint256 cryptoPaid, uint256 bankPaid, uint256 remaining)',
  'function lands(uint256) view returns (address owner, address seller, string memory ipfsHash, bytes32 documentHash, uint256 totalPrice, address lockedTo)',
  'function isRegistered(uint256) view returns (bool)',
  'function nextLandId() view returns (uint256)',
  'event LandLocked(uint256 indexed landId, address indexed buyer)',
  'event LandUpdateRequested(uint256 indexed landId, address indexed seller, bytes32 newDocumentHash)',
  'event LandUpdateApproved(uint256 indexed landId, address indexed seller)',
  'event PaymentReceived(uint256 indexed landId, address indexed buyer, uint256 amount, bool isBankPayment)',
];

// ERC20 Token ABI
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) external returns (bool)',
];

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.Provider | null = null;
  private signer: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress: string | null = null;

  constructor(private configService: ConfigService) {
    this.initializeProvider();
    this.initializeContract();
  }

  /**
   * Initialize blockchain provider from RPC URL
   */
  private initializeProvider(): void {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');

    if (!rpcUrl) {
      this.logger.warn(
        'BLOCKCHAIN_RPC_URL not configured. Blockchain integration will be disabled.',
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
   * Initialize smart contract connection
   */
  private initializeContract(): void {
    const contractAddress = this.configService.get<string>(
      'SMART_CONTRACT_ADDRESS',
    );
    const adminPrivateKey = this.configService.get<string>(
      'BLOCKCHAIN_ADMIN_PRIVATE_KEY',
    );

    if (!contractAddress || !adminPrivateKey) {
      this.logger.warn(
        'SMART_CONTRACT_ADDRESS or BLOCKCHAIN_ADMIN_PRIVATE_KEY not configured. Contract operations will be disabled.',
      );
      return;
    }

    if (!this.provider) {
      this.logger.warn(
        'Blockchain provider not initialized. Contract operations will be disabled.',
      );
      return;
    }

    try {
      // Create signer from admin private key
      this.signer = new ethers.Wallet(adminPrivateKey, this.provider);
      this.contractAddress = contractAddress;

      // Create contract instance
      this.contract = new ethers.Contract(
        contractAddress,
        LAND_REGISTRY_ABI,
        this.signer,
      );

      this.logger.log(
        `Smart contract initialized at ${contractAddress} with admin address ${this.signer.address}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize smart contract:', error);
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

  /**
   * Check if contract is available
   */
  isContractAvailable(): boolean {
    return this.contract !== null && this.signer !== null;
  }

  /**
   * Register land on blockchain
   * @param ownerAddress - Owner/seller wallet address
   * @param ipfsHash - IPFS hash of land documents
   * @param documentHash - SHA-256 hash of document (as hex string)
   * @param totalPrice - Total price in wei (or token units)
   * @returns Registration result with blockchain land ID and transaction hash
   */
  async registerLand(
    ownerAddress: string,
    ipfsHash: string,
    documentHash: string,
    totalPrice: bigint,
  ): Promise<RegisterLandResult> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available. Please configure blockchain settings.',
      };
    }

    try {
      // Convert document hash from hex string to bytes32
      const documentHashBytes32 = ethers.hexlify(
        ethers.getBytes(documentHash.startsWith('0x') ? documentHash : `0x${documentHash}`),
      );

      // Ensure it's exactly 32 bytes (64 hex chars)
      if (documentHashBytes32.length !== 66) {
        // 0x + 64 chars = 66
        return {
          success: false,
          error: 'Document hash must be 32 bytes (64 hex characters)',
        };
      }

      // Get next land ID before registration (for reference)
      const nextLandIdBefore = await this.contract!.nextLandId();

      // Call registerLand function
      const tx = await this.contract!.registerLand(
        ownerAddress,
        ipfsHash,
        documentHashBytes32,
        totalPrice,
      );

      this.logger.log(
        `Registering land on blockchain. Transaction: ${tx.hash}`,
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      // Get the land ID (it should be nextLandIdBefore)
      const landId = Number(nextLandIdBefore);

      this.logger.log(
        `Land registered successfully on blockchain. Land ID: ${landId}, TX: ${tx.hash}`,
      );

      return {
        success: true,
        landId,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error registering land on blockchain:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Lock land to buyer (called by backend on behalf of buyer)
   * @param landId - Blockchain land ID
   * @param buyerAddress - Buyer wallet address
   * @returns Lock result with transaction hash
   */
  async lockLandToBuyer(
    landId: number,
    buyerAddress: string,
  ): Promise<LockLandResult> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available. Please configure blockchain settings.',
      };
    }

    try {
      // Call lockLandToBuyer function (admin-only, backend calls on behalf of buyer)
      const tx = await this.contract!.lockLandToBuyer(landId, buyerAddress);

      this.logger.log(
        `Locking land ${landId} to buyer ${buyerAddress} on blockchain. Transaction: ${tx.hash}`,
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Land ${landId} locked to ${buyerAddress} successfully. TX: ${tx.hash}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error(`Error locking land ${landId} on blockchain:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get land data from blockchain
   * @param landId - Blockchain land ID
   * @returns Land data from blockchain
   */
  async getLandFromBlockchain(landId: number): Promise<{
    owner: string;
    seller: string;
    ipfsHash: string;
    documentHash: string;
    totalPrice: bigint;
    lockedTo: string;
  } | null> {
    if (!this.isContractAvailable() || !this.provider) {
      return null;
    }

    try {
      const landData = await this.contract!.lands(landId);
      return {
        owner: landData[0],
        seller: landData[1],
        ipfsHash: landData[2],
        documentHash: landData[3],
        totalPrice: landData[4],
        lockedTo: landData[5],
      };
    } catch (error) {
      this.logger.error(
        `Error getting land ${landId} from blockchain:`,
        error,
      );
      return null;
    }
  }

  /**
   * Verify document hash from blockchain
   * @param landId - Blockchain land ID
   * @param documentHash - SHA-256 hash to verify (as hex string)
   * @returns true if hash matches blockchain, false otherwise
   */
  async verifyDocumentHash(
    landId: number,
    documentHash: string,
  ): Promise<boolean> {
    const landData = await this.getLandFromBlockchain(landId);

    if (!landData) {
      return false;
    }

    // Convert blockchain bytes32 to hex string for comparison
    const blockchainHash = ethers.hexlify(landData.documentHash);
    const providedHash = documentHash.startsWith('0x')
      ? documentHash
      : `0x${documentHash}`;

    // Compare hashes (case-insensitive)
    return blockchainHash.toLowerCase() === providedHash.toLowerCase();
  }

  /**
   * Check if land is registered on blockchain
   * @param landId - Blockchain land ID
   * @returns true if registered, false otherwise
   */
  async isLandRegistered(landId: number): Promise<boolean> {
    if (!this.isContractAvailable()) {
      return false;
    }

    try {
      return await this.contract!.isRegistered(landId);
    } catch (error) {
      this.logger.error(
        `Error checking registration status for land ${landId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Update land information on blockchain
   * @param landId - Blockchain land ID
   * @param ipfsHash - New IPFS hash (empty string to keep existing)
   * @param documentHash - New document hash (empty string to keep existing)
   * @param totalPrice - New total price (0 to keep existing)
   * @returns Update result with transaction hash and approval status
   */
  async updateLand(
    landId: number,
    ipfsHash: string,
    documentHash: string,
    totalPrice: bigint,
  ): Promise<UpdateLandResult> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available. Please configure blockchain settings.',
      };
    }

    try {
      // Convert document hash from hex string to bytes32
      let documentHashBytes32: string;
      const requiresDocumentUpdate = !!(documentHash && documentHash.length > 0);

      if (requiresDocumentUpdate) {
        documentHashBytes32 = ethers.hexlify(
          ethers.getBytes(
            documentHash.startsWith('0x') ? documentHash : `0x${documentHash}`,
          ),
        );

        // Ensure it's exactly 32 bytes (64 hex chars)
        if (documentHashBytes32.length !== 66) {
          return {
            success: false,
            error: 'Document hash must be 32 bytes (64 hex characters)',
          };
        }
      } else {
        // Use zero bytes32 to indicate "keep existing"
        documentHashBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
      }

      // Call updateLand function
      const tx = await this.contract!.updateLand(
        landId,
        ipfsHash || '', // Empty string to keep existing
        documentHashBytes32,
        totalPrice || BigInt(0), // 0 to keep existing
      );

      this.logger.log(
        `Updating land ${landId} on blockchain. Transaction: ${tx.hash}`,
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Land ${landId} updated successfully. TX: ${tx.hash}, Requires seller approval: ${requiresDocumentUpdate}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
        requiresSellerApproval: requiresDocumentUpdate,
      };
    } catch (error) {
      this.logger.error(`Error updating land ${landId} on blockchain:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get user's wallet signer from private key
   * @param privateKey - User's private key (from HD wallet)
   * @returns Wallet signer connected to provider
   */
  private getUserSigner(privateKey: string): ethers.Wallet {
    if (!this.provider) {
      throw new Error('Blockchain provider not initialized');
    }
    return new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * Approve ERC20 tokens for contract (using user's HD wallet)
   * @param userPrivateKey - User's private key (from HD wallet)
   * @param amount - Amount to approve (in token units, will be converted based on token decimals)
   * @returns Approval result with transaction hash
   */
  async approveTokenForContract(
    userPrivateKey: string,
    amount: bigint,
  ): Promise<ApproveTokenResult> {
    if (!this.isContractAvailable() || !this.provider) {
      return {
        success: false,
        error: 'Blockchain service not available',
      };
    }

    const tokenAddress = this.configService.get<string>(
      'PAYMENT_TOKEN_ADDRESS',
    );
    if (!tokenAddress) {
      return {
        success: false,
        error: 'PAYMENT_TOKEN_ADDRESS not configured',
      };
    }

    try {
      const userSigner = this.getUserSigner(userPrivateKey);
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        userSigner,
      );

      // Get token decimals
      const decimals = await tokenContract.decimals();
      const amountWithDecimals = amount * BigInt(10 ** Number(decimals));

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(
        userSigner.address,
        this.contractAddress,
      );

      if (currentAllowance >= amountWithDecimals) {
        this.logger.log(
          `Tokens already approved. Current allowance: ${currentAllowance}`,
        );
        return {
          success: true,
          // No transaction needed, already approved
        };
      }

      // Approve tokens
      const tx = await tokenContract.approve(
        this.contractAddress!,
        amountWithDecimals,
      );

      this.logger.log(
        `Approving ${amountWithDecimals} tokens (${amount} with ${decimals} decimals) for user ${userSigner.address}. TX: ${tx.hash}`,
      );

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Approval transaction failed',
        };
      }

      this.logger.log(`Token approval successful. TX: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error approving tokens:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Make ERC20 payment on behalf of user (using user's HD wallet)
   * @param landId - Blockchain land ID
   * @param userPrivateKey - User's private key (from HD wallet)
   * @param amount - Payment amount (in base token units, will be converted based on decimals)
   * @returns Payment result with transaction hash
   */
  async makeERC20Payment(
    landId: number,
    userPrivateKey: string,
    amount: bigint,
  ): Promise<MakePaymentResult> {
    if (!this.isContractAvailable() || !this.provider) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    const tokenAddress = this.configService.get<string>(
      'PAYMENT_TOKEN_ADDRESS',
    );
    if (!tokenAddress) {
      return {
        success: false,
        error: 'PAYMENT_TOKEN_ADDRESS not configured',
      };
    }

    try {
      const userSigner = this.getUserSigner(userPrivateKey);

      // Get token contract to check decimals
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider,
      );
      const decimals = await tokenContract.decimals();
      const amountWithDecimals = amount * BigInt(10 ** Number(decimals));

      // First, ensure tokens are approved
      const approveResult = await this.approveTokenForContract(
        userPrivateKey,
        amount,
      );

      if (!approveResult.success && !approveResult.transactionHash) {
        // Approval failed and no transaction was made (already approved is OK)
        if (approveResult.error && !approveResult.error.includes('already')) {
          return approveResult;
        }
      }

      // Call makePayment on contract (admin calls on behalf of buyer)
      // Note: Buyer must have approved tokens for the contract first
      const tx = await this.contract!.makePayment(
        landId,
        userSigner.address,
        amountWithDecimals,
      );

      this.logger.log(
        `Making payment of ${amountWithDecimals} tokens (${amount} with ${decimals} decimals) for land ${landId} by user ${userSigner.address}. TX: ${tx.hash}`,
      );

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Payment transaction failed',
        };
      }

      this.logger.log(
        `ERC20 payment successful for land ${landId}. TX: ${tx.hash}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error making ERC20 payment:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get payment breakdown from blockchain
   * @param landId - Blockchain land ID
   * @returns Payment breakdown
   */
  async getPaymentBreakdown(landId: number): Promise<{
    totalPaid: bigint;
    cryptoPaid: bigint;
    bankPaid: bigint;
    remaining: bigint;
  } | null> {
    if (!this.isContractAvailable()) {
      return null;
    }

    try {
      const breakdown = await this.contract!.getPaymentBreakdown(landId);
      return {
        totalPaid: breakdown[0],
        cryptoPaid: breakdown[1],
        bankPaid: breakdown[2],
        remaining: breakdown[3],
      };
    } catch (error) {
      this.logger.error(
        `Error getting payment breakdown for land ${landId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Admin unlock land on blockchain
   * @param landId - Blockchain land ID
   * @returns Unlock result with transaction hash
   */
  async adminUnlockLand(landId: number): Promise<LockLandResult> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = await this.contract!.adminUnlockLand(landId);

      this.logger.log(
        `Unlocking land ${landId} on blockchain. Transaction: ${tx.hash}`,
      );

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(`Land ${landId} unlocked successfully. TX: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error(`Error unlocking land ${landId}:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
