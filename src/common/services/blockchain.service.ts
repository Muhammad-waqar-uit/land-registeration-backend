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

export interface MakePaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export interface LedgerTxResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

// Smart Contract ABI - Complete integration with LandRegistryUpgradeable contract
const LAND_REGISTRY_ABI = [
  // Land registration and management
  'function registerLand(address _owner, string memory _ipfsHash, bytes32 _documentHash, uint256 _totalPrice) external',
  'function lockLandToBuyer(uint256 landId, address buyer) external',
  'function updateLand(uint256 landId, string memory _ipfsHash, bytes32 _documentHash, uint256 _totalPrice) external',
  'function sellerApproveUpdate(uint256 landId, address seller) external',
  'function sellerRevokeUpdateApproval(uint256 landId, address seller) external',
  'function adminUnlockLand(uint256 landId) external',
  // Payments (bank only; ledger/points used for recording)
  'function submitBankPayment(uint256 landId, address buyer, uint256 amount, string memory proofHash) external',
  'function verifyBankPayment(uint256 landId, bool approved) external',
  // Ownership transfer
  'function requestSellerApproval(uint256 landId) external',
  'function sellerApproveTransfer(uint256 landId, address seller) external',
  'function sellerRevokeApproval(uint256 landId, address seller) external',
  'function adminBypassSellerApproval(uint256 landId) external',
  // Refunds
  'function requestRefund(uint256 landId, address buyer) external',
  // Builder registry
  'function registerBuilder(address builderAddress, string memory licenseNumber) external',
  'function grantBuilderRole(address builder) external',
  'function revokeBuilderRole(address builder) external',
  'function getBuilderInfo(address builderAddress) view returns (address, string memory, bool, uint256)',
  'function isLicenseRegistered(string memory licenseNumber) view returns (bool, address)',
  // Agreement and ownership document storage
  'function storeAgreementHash(uint256 landId, bytes32 agreementHash, string memory agreementIPFSHash) external',
  'function storeOwnershipDocumentHash(uint256 landId, bytes32 documentHash, string memory documentIPFSHash) external',
  // Configuration
  'function setPenaltyBasisPoints(uint16 _penaltyBasisPoints) external',
  // View functions
  'function getPaymentBreakdown(uint256 landId) view returns (uint256 totalPaid, uint256 cryptoPaid, uint256 bankPaid, uint256 remaining)',
  'function getAgreementHash(uint256 landId) view returns (bytes32, string memory, uint256, bool)',
  'function getOwnershipDocumentHash(uint256 landId) view returns (bytes32, string memory, uint256, bool)',
  'function getSellerApprovalStatus(uint256 landId) view returns (bool, bool, address)',
  'function lands(uint256) view returns (address owner, address seller, string memory ipfsHash, bytes32 documentHash, uint256 totalPrice, address lockedTo)',
  'function isRegistered(uint256) view returns (bool)',
  'function nextLandId() view returns (uint256)',
  // Events
  'event LandLocked(uint256 indexed landId, address indexed buyer)',
  'event LandUpdateRequested(uint256 indexed landId, address indexed seller, bytes32 newDocumentHash)',
  'event LandUpdateApproved(uint256 indexed landId, address indexed seller)',
  'event LandUpdateRevoked(uint256 indexed landId, address indexed seller)',
  'event PaymentReceived(uint256 indexed landId, address indexed buyer, uint256 amount, bool isBankPayment)',
  'event BankPaymentSubmitted(uint256 indexed landId, address indexed buyer, uint256 amount, string proofHash)',
  'event BankPaymentVerified(uint256 indexed landId, address verifier, uint256 amount)',
  'event BankPaymentRejected(uint256 indexed landId, address verifier)',
  'event OwnershipTransferred(uint256 indexed landId, address oldOwner, address newOwner)',
  'event SellerApprovalRequested(uint256 indexed landId, address buyer)',
  'event SellerApprovalGranted(uint256 indexed landId, address seller)',
  'event SellerApprovalRevoked(uint256 indexed landId, address seller)',
  'event RefundProcessed(uint256 indexed landId, address buyer, uint256 refundedAmount, uint256 penalty)',
  'event PenaltyBasisPointsUpdated(uint16 oldPenalty, uint16 newPenalty)',
  'event BuilderRegistered(address indexed builder, string licenseNumber, uint256 registeredAt)',
  'event AgreementHashStored(uint256 indexed landId, bytes32 agreementHash, string agreementIPFSHash, uint256 storedAt)',
  'event OwnershipDocumentHashStored(uint256 indexed landId, bytes32 documentHash, string documentIPFSHash, uint256 storedAt)',
];

// LandLedgerLite ABI (storage-focused ledger contract)
const LAND_LEDGER_ABI = [
  'function registerProperty(bytes32 offchainId, address builder, address currentOwner) external returns (uint256)',
  'function updatePropertyOwner(uint256 propertyId, address newOwner, bool isResale) external',
  'function updatePropertyOwnerByOffchainId(bytes32 offchainLandId, address builder, address newOwner, bool isResale) external',
  'function recordTrade(uint256 propertyId, address seller, address buyer, uint256 price, bool isResale, bytes32 offchainAgreementId) external returns (uint256)',
  'function recordTradeByOffchainId(bytes32 offchainLandId, address builder, address seller, address buyer, uint256 price, bool isResale, bytes32 offchainAgreementId) external returns (uint256)',
  'function recordPayment(uint256 propertyId, uint256 tradeId, address payer, address payee, address token, uint256 amount, bytes32 offchainPaymentId) external returns (uint256)',
  'function recordPaymentByOffchainId(bytes32 offchainLandId, address builder, uint256 tradeId, address payer, address payee, address token, uint256 amount, bytes32 offchainPaymentId) external returns (uint256)',
  'function propertyIdByOffchainId(bytes32 offchainId) view returns (uint256)',
  'function awardPoints(address to, uint256 amount) external',
  'function transferPoints(address from, address to, uint256 amount) external',
  'function getBalance(address user) view returns (uint256)',
];

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.Provider | null = null;
  private signer: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress: string | null = null;
  private ledgerContract: ethers.Contract | null = null;
  private ledgerContractAddress: string | null = null;

  constructor(private configService: ConfigService) {
    this.initializeProvider();
    this.initializeContract();
    this.initializeLedgerContract();
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
   * Initialize LandLedgerLite contract connection (storage ledger)
   */
  private initializeLedgerContract(): void {
    const contractAddress = this.configService.get<string>(
      'LEDGER_CONTRACT_ADDRESS',
    );
    const adminPrivateKey = this.configService.get<string>(
      'BLOCKCHAIN_ADMIN_PRIVATE_KEY',
    );

    if (!contractAddress || !adminPrivateKey) {
      this.logger.warn(
        'LEDGER_CONTRACT_ADDRESS or BLOCKCHAIN_ADMIN_PRIVATE_KEY not configured. Ledger operations will be disabled.',
      );
      return;
    }

    if (!this.provider) {
      this.logger.warn(
        'Blockchain provider not initialized. Ledger operations will be disabled.',
      );
      return;
    }

    try {
      const signer = new ethers.Wallet(adminPrivateKey, this.provider);
      this.signer = this.signer ?? signer;
      this.ledgerContractAddress = contractAddress;
      this.ledgerContract = new ethers.Contract(
        contractAddress,
        LAND_LEDGER_ABI,
        signer,
      );
      this.logger.log(
        `LandLedgerLite initialized at ${contractAddress} with admin address ${signer.address}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize LandLedgerLite contract:', error);
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
      const receipt =
        await this.provider.getTransactionReceipt(transactionHash);

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

  // ---------------------------------------------------------------------------
  // LandLedgerLite helpers (record-only ledger)
  // ---------------------------------------------------------------------------

  isLedgerAvailable(): boolean {
    return !!this.provider && !!this.ledgerContract && !!this.ledgerContractAddress;
  }

  /**
   * Helper to turn arbitrary string (UUID, ID) into bytes32 for offchain IDs.
   */
  private hashOffchainId(id: string): string {
    // keccak256 of UTF-8 string
    return ethers.id(id);
  }

  /**
   * Register a property in the ledger (mirror of DB land record).
   */
  async ledgerRegisterProperty(
    offchainLandId: string,
    builderAddress: string,
    currentOwnerAddress: string,
  ): Promise<LedgerTxResult> {
    if (!this.isLedgerAvailable()) {
      return {
        success: false,
        error: 'Ledger contract not available',
      };
    }

    try {
      const offchainHash = this.hashOffchainId(offchainLandId);
      const tx = (await this.ledgerContract!.registerProperty(
        offchainHash,
        builderAddress,
        currentOwnerAddress,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Ledger: registering property for offchainId=${offchainLandId}. TX=${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;
      if (!receipt || receipt.status !== 1) {
        return { success: false, error: 'Ledger transaction failed or reverted' };
      }

      return { success: true, transactionHash: tx.hash };
    } catch (error) {
      this.logger.error('Ledger: error registering property', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get ledger propertyId for a given offchain land ID (DB land.id).
   */
  private async getLedgerPropertyIdByOffchainId(
    offchainLandId: string,
  ): Promise<number | null> {
    if (!this.isLedgerAvailable()) {
      return null;
    }
    try {
      const offchainHash = this.hashOffchainId(offchainLandId);
      const idBig = (await this.ledgerContract!.propertyIdByOffchainId(
        offchainHash,
      )) as bigint;
      const id = Number(idBig);
      return id === 0 ? null : id;
    } catch (error) {
      this.logger.error(
        `Ledger: error getting propertyId for offchainId=${offchainLandId}`,
        error,
      );
      return null;
    }
  }

  /**
   * Update property owner in ledger (sale or resale).
   * If builderAddress is provided, uses updatePropertyOwnerByOffchainId so property is registered if missing.
   */
  async ledgerUpdatePropertyOwner(
    offchainLandId: string,
    newOwnerAddress: string,
    isResale: boolean,
    builderAddress?: string,
  ): Promise<LedgerTxResult> {
    if (!this.isLedgerAvailable()) {
      return {
        success: false,
        error: 'Ledger contract not available',
      };
    }
    if (builderAddress) {
      try {
        const landHash = this.hashOffchainId(offchainLandId);
        const tx = (await this.ledgerContract!.updatePropertyOwnerByOffchainId(
          landHash,
          builderAddress,
          newOwnerAddress,
          isResale,
        )) as ethers.ContractTransactionResponse;
        this.logger.log(
          `Ledger: updating property owner by offchainId land=${offchainLandId} newOwner=${newOwnerAddress}. TX=${tx.hash}`,
        );
        const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;
        if (!receipt || receipt.status !== 1) {
          return { success: false, error: 'Ledger transaction failed or reverted' };
        }
        return { success: true, transactionHash: tx.hash };
      } catch (error) {
        this.logger.error('Ledger: error updating property owner by offchainId', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    const propertyId = await this.getLedgerPropertyIdByOffchainId(offchainLandId);
    if (!propertyId) {
      return { success: false, error: 'Ledger property not found for land' };
    }
    try {
      const tx = (await this.ledgerContract!.updatePropertyOwner(
        propertyId,
        newOwnerAddress,
        isResale,
      )) as ethers.ContractTransactionResponse;
      this.logger.log(
        `Ledger: updating property owner propertyId=${propertyId} newOwner=${newOwnerAddress}. TX=${tx.hash}`,
      );
      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;
      if (!receipt || receipt.status !== 1) {
        return { success: false, error: 'Ledger transaction failed or reverted' };
      }
      return { success: true, transactionHash: tx.hash };
    } catch (error) {
      this.logger.error('Ledger: error updating property owner', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Record a trade (sale or resale) in the ledger.
   * If builderAddress is provided, uses recordTradeByOffchainId so the property is registered on ledger if missing (no "property not found").
   */
  async ledgerRecordTrade(
    offchainLandId: string,
    sellerAddress: string,
    buyerAddress: string,
    priceInBaseUnits: bigint,
    isResale: boolean,
    offchainAgreementId: string,
    builderAddress?: string,
  ): Promise<LedgerTxResult> {
    if (!this.isLedgerAvailable()) {
      return {
        success: false,
        error: 'Ledger contract not available',
      };
    }
    const agreementHash = this.hashOffchainId(offchainAgreementId);
    const landHash = this.hashOffchainId(offchainLandId);

    if (builderAddress) {
      try {
        const tx = (await this.ledgerContract!.recordTradeByOffchainId(
          landHash,
          builderAddress,
          sellerAddress,
          buyerAddress,
          priceInBaseUnits,
          isResale,
          agreementHash,
        )) as ethers.ContractTransactionResponse;
        this.logger.log(
          `Ledger: recording trade by offchainId land=${offchainLandId}, seller=${sellerAddress}, buyer=${buyerAddress}. TX=${tx.hash}`,
        );
        const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;
        if (!receipt || receipt.status !== 1) {
          return { success: false, error: 'Ledger transaction failed or reverted' };
        }
        return { success: true, transactionHash: tx.hash };
      } catch (error) {
        this.logger.error('Ledger: error recording trade by offchainId', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    const propertyId = await this.getLedgerPropertyIdByOffchainId(offchainLandId);
    if (!propertyId) {
      return { success: false, error: 'Ledger property not found for land' };
    }
    try {
      const tx = (await this.ledgerContract!.recordTrade(
        propertyId,
        sellerAddress,
        buyerAddress,
        priceInBaseUnits,
        isResale,
        agreementHash,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Ledger: recording trade propertyId=${propertyId}, seller=${sellerAddress}, buyer=${buyerAddress}, price=${priceInBaseUnits}. TX=${tx.hash}`,
      );
      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;
      if (!receipt || receipt.status !== 1) {
        return { success: false, error: 'Ledger transaction failed or reverted' };
      }
      return { success: true, transactionHash: tx.hash };
    } catch (error) {
      this.logger.error('Ledger: error recording trade', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Record a payment in the ledger.
   * If builderAddress is provided, uses recordPaymentByOffchainId so property is registered if missing.
   */
  async ledgerRecordPayment(
    offchainLandId: string,
    tradeId: number,
    payer: string,
    payee: string,
    tokenAddress: string,
    amountInBaseUnits: bigint,
    offchainPaymentId: string,
    builderAddress?: string,
  ): Promise<LedgerTxResult> {
    if (!this.isLedgerAvailable()) {
      return {
        success: false,
        error: 'Ledger contract not available',
      };
    }
    const token =
      tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000'
        ? tokenAddress
        : this.ledgerContractAddress!;
    const paymentHash = this.hashOffchainId(offchainPaymentId);
    const landHash = this.hashOffchainId(offchainLandId);

    if (builderAddress) {
      try {
        const tx = (await this.ledgerContract!.recordPaymentByOffchainId(
          landHash,
          builderAddress,
          tradeId,
          payer,
          payee,
          token,
          amountInBaseUnits,
          paymentHash,
        )) as ethers.ContractTransactionResponse;
        this.logger.log(
          `Ledger: recording payment by offchainId land=${offchainLandId}, tradeId=${tradeId}, amount=${amountInBaseUnits}. TX=${tx.hash}`,
        );
        const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;
        if (!receipt || receipt.status !== 1) {
          return { success: false, error: 'Ledger transaction failed or reverted' };
        }
        return { success: true, transactionHash: tx.hash };
      } catch (error) {
        this.logger.error('Ledger: error recording payment by offchainId', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    const propertyId = await this.getLedgerPropertyIdByOffchainId(offchainLandId);
    if (!propertyId) {
      return { success: false, error: 'Ledger property not found for land' };
    }
    try {
      const tx = (await this.ledgerContract!.recordPayment(
        propertyId,
        tradeId,
        payer,
        payee,
        token,
        amountInBaseUnits,
        paymentHash,
      )) as ethers.ContractTransactionResponse;
      this.logger.log(
        `Ledger: recording payment propertyId=${propertyId}, tradeId=${tradeId}, amount=${amountInBaseUnits}. TX=${tx.hash}`,
      );
      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;
      if (!receipt || receipt.status !== 1) {
        return { success: false, error: 'Ledger transaction failed or reverted' };
      }
      return { success: true, transactionHash: tx.hash };
    } catch (error) {
      this.logger.error('Ledger: error recording payment', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get point balance from LandLedgerLite for a wallet address.
   */
  async ledgerGetBalance(
    walletAddress: string,
  ): Promise<{ success: boolean; balance?: string; error?: string }> {
    if (!this.isLedgerAvailable()) {
      return { success: false, error: 'Ledger contract not available' };
    }
    try {
      const bal = (await this.ledgerContract!.getBalance(
        walletAddress,
      )) as bigint;
      return { success: true, balance: bal.toString() };
    } catch (error) {
      this.logger.error(
        `Ledger: error getting balance for ${walletAddress}`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Admin-only: mint/award points to a given wallet in LandLedgerLite.
   */
  async ledgerAwardPoints(
    walletAddress: string,
    amountInBaseUnits: bigint,
  ): Promise<LedgerTxResult> {
    if (!this.isLedgerAvailable()) {
      return { success: false, error: 'Ledger contract not available' };
    }
    try {
      const tx = (await this.ledgerContract!.awardPoints(
        walletAddress,
        amountInBaseUnits,
      )) as ethers.ContractTransactionResponse;
      this.logger.log(
        `Ledger: awarding ${amountInBaseUnits} points to ${walletAddress}. TX=${tx.hash}`,
      );
      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;
      if (!receipt || receipt.status !== 1) {
        return { success: false, error: 'Ledger transaction failed or reverted' };
      }
      return { success: true, transactionHash: tx.hash };
    } catch (error) {
      this.logger.error(
        `Ledger: error awarding points to ${walletAddress}`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Transfer points from one address to another (e.g. buyer pays seller with points).
   * Admin-only on contract. Used for payment mode POINTS.
   */
  async ledgerTransferPoints(
    fromAddress: string,
    toAddress: string,
    amountInBaseUnits: bigint,
  ): Promise<LedgerTxResult> {
    if (!this.isLedgerAvailable()) {
      return { success: false, error: 'Ledger contract not available' };
    }
    try {
      const tx = (await this.ledgerContract!.transferPoints(
        fromAddress,
        toAddress,
        amountInBaseUnits,
      )) as ethers.ContractTransactionResponse;
      this.logger.log(
        `Ledger: transfer ${amountInBaseUnits} points from ${fromAddress} to ${toAddress}. TX=${tx.hash}`,
      );
      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;
      if (!receipt || receipt.status !== 1) {
        return { success: false, error: 'Ledger transfer failed or reverted' };
      }
      return { success: true, transactionHash: tx.hash };
    } catch (error) {
      this.logger.error(
        `Ledger: error transferring points from ${fromAddress} to ${toAddress}`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(
    txHash: string,
  ): Promise<ethers.TransactionResponse | null> {
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
        error:
          'Smart contract not available. Please configure blockchain settings.',
      };
    }

    try {
      // Convert document hash from hex string to bytes32
      const documentHashBytes32 = ethers.hexlify(
        ethers.getBytes(
          documentHash.startsWith('0x') ? documentHash : `0x${documentHash}`,
        ),
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const nextLandIdBefore = await this.contract!.nextLandId();

      // Call registerLand function
      const tx = (await this.contract!.registerLand(
        ownerAddress,
        ipfsHash,
        documentHashBytes32,
        totalPrice,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Registering land on blockchain. Transaction: ${tx.hash}`,
      );

      // Wait for transaction to be mined
      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

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
        error:
          'Smart contract not available. Please configure blockchain settings.',
      };
    }

    try {
      // Call lockLandToBuyer function (admin-only, backend calls on behalf of buyer)
      const tx = (await this.contract!.lockLandToBuyer(
        landId,
        buyerAddress,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Locking land ${landId} to buyer ${buyerAddress} on blockchain. Transaction: ${tx.hash}`,
      );

      // Wait for transaction to be mined
      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const landData = await this.contract!.lands(landId);
      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        owner: landData[0] as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        seller: landData[1] as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ipfsHash: landData[2] as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        documentHash: landData[3] as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        totalPrice: landData[4] as bigint,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        lockedTo: landData[5] as string,
      };
    } catch (error) {
      this.logger.error(`Error getting land ${landId} from blockchain:`, error);
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
        error:
          'Smart contract not available. Please configure blockchain settings.',
      };
    }

    try {
      // Convert document hash from hex string to bytes32
      let documentHashBytes32: string;
      const requiresDocumentUpdate = !!(
        documentHash && documentHash.length > 0
      );

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
        documentHashBytes32 =
          '0x0000000000000000000000000000000000000000000000000000000000000000';
      }

      // Call updateLand function
      const tx = (await this.contract!.updateLand(
        landId,
        ipfsHash || '', // Empty string to keep existing
        documentHashBytes32,
        totalPrice || BigInt(0), // 0 to keep existing
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Updating land ${landId} on blockchain. Transaction: ${tx.hash}`,
      );

      // Wait for transaction to be mined
      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

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
   * Store agreement hash on blockchain
   * @param landId - Blockchain land ID
   * @param agreementHash - SHA-256 hash of signed agreement
   * @param ipfsHash - IPFS hash of signed agreement document
   * @returns Transaction result
   */
  async storeAgreementHash(
    landId: number,
    agreementHash: string,
    ipfsHash: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      // Convert hash to bytes32
      const hashBytes32 = ethers.hexlify(
        ethers.getBytes(
          agreementHash.startsWith('0x') ? agreementHash : `0x${agreementHash}`,
        ),
      );

      // Ensure it's exactly 32 bytes (64 hex chars)
      if (hashBytes32.length !== 66) {
        // 0x + 64 chars = 66
        return {
          success: false,
          error: 'Agreement hash must be 32 bytes (64 hex characters)',
        };
      }

      // Call storeAgreementHash function on contract
      const tx = (await this.contract!.storeAgreementHash(
        landId,
        hashBytes32,
        ipfsHash,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Storing agreement hash on blockchain for land ${landId}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Agreement hash stored successfully on blockchain. TX: ${tx.hash}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error storing agreement hash:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Store ownership document hash on blockchain
   * @param landId - Blockchain land ID
   * @param documentHash - SHA-256 hash of ownership document
   * @param ipfsHash - IPFS hash of ownership document
   * @returns Transaction result
   */
  async storeOwnershipDocumentHash(
    landId: number,
    documentHash: string,
    ipfsHash: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      // Convert hash to bytes32
      const hashBytes32 = ethers.hexlify(
        ethers.getBytes(
          documentHash.startsWith('0x') ? documentHash : `0x${documentHash}`,
        ),
      );

      // Ensure it's exactly 32 bytes (64 hex chars)
      if (hashBytes32.length !== 66) {
        // 0x + 64 chars = 66
        return {
          success: false,
          error: 'Document hash must be 32 bytes (64 hex characters)',
        };
      }

      // Call storeOwnershipDocumentHash function on contract
      const tx = (await this.contract!.storeOwnershipDocumentHash(
        landId,
        hashBytes32,
        ipfsHash,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Storing ownership document hash on blockchain for land ${landId}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Ownership document hash stored successfully on blockchain. TX: ${tx.hash}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error storing ownership document hash:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Transfer ownership on blockchain (after payment completion and approvals)
   * Calls sellerApproveTransfer to complete ownership transfer on-chain
   * @param landId - Blockchain land ID
   * @param sellerAddress - Seller/builder address (must match land seller)
   * @returns Transaction result
   */
  async transferOwnership(
    landId: number,
    sellerAddress: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      // Get land data to verify seller matches
      const landData = (await this.contract!.lands(landId)) as [
        string,
        string,
        string,
        string,
        bigint,
        string,
      ];
      const currentSeller = landData[1]; // seller

      if (currentSeller.toLowerCase() !== sellerAddress.toLowerCase()) {
        return {
          success: false,
          error: 'Seller address does not match land seller',
        };
      }

      // Check payment breakdown to verify payment is complete
      const breakdown = (await this.contract!.getPaymentBreakdown(landId)) as {
        remaining: bigint;
      };
      if (breakdown.remaining > 0) {
        return {
          success: false,
          error: `Payment not complete. Remaining: ${breakdown.remaining}`,
        };
      }

      // Call sellerApproveTransfer to complete ownership transfer
      const tx = (await this.contract!.sellerApproveTransfer(
        landId,
        sellerAddress,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Transferring ownership on blockchain for land ${landId}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Ownership transferred successfully on blockchain. TX: ${tx.hash}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error transferring ownership:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Register builder on blockchain (if smart contract supports)
   * @param builderAddress - Builder's wallet address
   * @param licenseNumber - Builder's license number
   * @returns Transaction result
   */
  async registerBuilder(
    builderAddress: string,
    licenseNumber: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      // Call registerBuilder function on contract
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const tx = await this.contract!.registerBuilder(
        builderAddress,
        licenseNumber,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const txHash = tx.hash as string;
      this.logger.log(
        `Registering builder on blockchain: ${builderAddress} (License: ${licenseNumber}). Transaction: ${txHash}`,
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const receipt = await tx.wait();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Builder registered successfully on blockchain. TX: ${txHash}`,
      );

      return {
        success: true,
        transactionHash: txHash,
      };
    } catch (error) {
      this.logger.error('Error registering builder:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Register property on blockchain (alias for registerLand for clarity)
   * @param ownerAddress - Owner's wallet address
   * @param ipfsHash - IPFS hash of property documents
   * @param documentHash - SHA-256 hash of document
   * @param totalPrice - Total price in wei
   * @returns Registration result
   */
  async registerProperty(
    ownerAddress: string,
    ipfsHash: string,
    documentHash: string,
    totalPrice: bigint,
  ): Promise<RegisterLandResult> {
    // Alias for registerLand - uses same underlying implementation
    return this.registerLand(ownerAddress, ipfsHash, documentHash, totalPrice);
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const breakdown = await this.contract!.getPaymentBreakdown(landId);
      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        totalPaid: breakdown[0] as bigint,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        cryptoPaid: breakdown[1] as bigint,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        bankPaid: breakdown[2] as bigint,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        remaining: breakdown[3] as bigint,
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
      const tx = (await this.contract!.adminUnlockLand(
        landId,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Unlocking land ${landId} on blockchain. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

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

  /**
   * Submit bank payment proof on blockchain
   * @param landId - Blockchain land ID
   * @param buyerAddress - Buyer wallet address
   * @param amount - Payment amount (in base token units)
   * @param proofHash - IPFS hash of bank payment proof document
   * @returns Transaction result
   */
  async submitBankPayment(
    landId: number,
    buyerAddress: string,
    amount: bigint,
    proofHash: string,
  ): Promise<MakePaymentResult> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.submitBankPayment(
        landId,
        buyerAddress,
        amount,
        proofHash,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Submitting bank payment proof for land ${landId} by buyer ${buyerAddress}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Bank payment proof submitted successfully. TX: ${tx.hash}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error submitting bank payment:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Verify or reject bank payment on blockchain
   * @param landId - Blockchain land ID
   * @param approved - true to approve, false to reject
   * @returns Transaction result
   */
  async verifyBankPayment(
    landId: number,
    approved: boolean,
  ): Promise<MakePaymentResult> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.verifyBankPayment(
        landId,
        approved,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `${approved ? 'Verifying' : 'Rejecting'} bank payment for land ${landId}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Bank payment ${approved ? 'verified' : 'rejected'} successfully. TX: ${tx.hash}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error verifying bank payment:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Request seller approval for ownership transfer
   * @param landId - Blockchain land ID
   * @returns Transaction result
   */
  async requestSellerApproval(
    landId: number,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.requestSellerApproval(
        landId,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Requesting seller approval for land ${landId}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(`Seller approval requested successfully. TX: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error requesting seller approval:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Admin bypass seller approval (emergency only)
   * @param landId - Blockchain land ID
   * @returns Transaction result
   */
  async adminBypassSellerApproval(
    landId: number,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.adminBypassSellerApproval(
        landId,
      )) as ethers.ContractTransactionResponse;

      this.logger.warn(
        `⚠️ Admin bypassing seller approval for land ${landId}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(`Seller approval bypassed successfully. TX: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error bypassing seller approval:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Revoke seller approval for ownership transfer
   * @param landId - Blockchain land ID
   * @param sellerAddress - Seller wallet address
   * @returns Transaction result
   */
  async revokeSellerApproval(
    landId: number,
    sellerAddress: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.sellerRevokeApproval(
        landId,
        sellerAddress,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Revoking seller approval for land ${landId} by seller ${sellerAddress}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(`Seller approval revoked successfully. TX: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error revoking seller approval:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Process refund request on blockchain
   * @param landId - Blockchain land ID
   * @param buyerAddress - Buyer wallet address
   * @returns Transaction result
   */
  async requestRefund(
    landId: number,
    buyerAddress: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.requestRefund(
        landId,
        buyerAddress,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Processing refund for land ${landId} for buyer ${buyerAddress}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(`Refund processed successfully. TX: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error processing refund:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Grant builder role on blockchain
   * @param builderAddress - Builder wallet address
   * @returns Transaction result
   */
  async grantBuilderRole(
    builderAddress: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.grantBuilderRole(
        builderAddress,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Granting builder role to ${builderAddress}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(`Builder role granted successfully. TX: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error granting builder role:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Revoke builder role on blockchain
   * @param builderAddress - Builder wallet address
   * @returns Transaction result
   */
  async revokeBuilderRole(
    builderAddress: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.revokeBuilderRole(
        builderAddress,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Revoking builder role from ${builderAddress}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(`Builder role revoked successfully. TX: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error revoking builder role:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Approve land update on behalf of seller (for document hash changes)
   * @param landId - Blockchain land ID
   * @param sellerAddress - Seller wallet address
   * @returns Transaction result
   */
  async sellerApproveUpdate(
    landId: number,
    sellerAddress: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.sellerApproveUpdate(
        landId,
        sellerAddress,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Seller approving update for land ${landId} by seller ${sellerAddress}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(`Land update approved successfully. TX: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error approving land update:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Revoke land update approval on behalf of seller
   * @param landId - Blockchain land ID
   * @param sellerAddress - Seller wallet address
   * @returns Transaction result
   */
  async sellerRevokeUpdateApproval(
    landId: number,
    sellerAddress: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    try {
      const tx = (await this.contract!.sellerRevokeUpdateApproval(
        landId,
        sellerAddress,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Seller revoking update approval for land ${landId} by seller ${sellerAddress}. Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Land update approval revoked successfully. TX: ${tx.hash}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error revoking land update approval:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get agreement hash from blockchain
   * @param landId - Blockchain land ID
   * @returns Agreement hash data or null
   */
  async getAgreementHash(landId: number): Promise<{
    agreementHash: string;
    agreementIPFSHash: string;
    storedAt: bigint;
    exists: boolean;
  } | null> {
    if (!this.isContractAvailable()) {
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const agreementData = await this.contract!.getAgreementHash(landId);
      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        agreementHash: agreementData[0] as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        agreementIPFSHash: agreementData[1] as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        storedAt: agreementData[2] as bigint,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        exists: agreementData[3] as boolean,
      };
    } catch (error) {
      this.logger.error(
        `Error getting agreement hash for land ${landId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get ownership document hash from blockchain
   * @param landId - Blockchain land ID
   * @returns Ownership document hash data or null
   */
  async getOwnershipDocumentHash(landId: number): Promise<{
    documentHash: string;
    documentIPFSHash: string;
    storedAt: bigint;
    exists: boolean;
  } | null> {
    if (!this.isContractAvailable()) {
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const docData = await this.contract!.getOwnershipDocumentHash(landId);
      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        documentHash: docData[0] as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        documentIPFSHash: docData[1] as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        storedAt: docData[2] as bigint,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        exists: docData[3] as boolean,
      };
    } catch (error) {
      this.logger.error(
        `Error getting ownership document hash for land ${landId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get seller approval status from blockchain
   * @param landId - Blockchain land ID
   * @returns Seller approval status or null
   */
  async getSellerApprovalStatus(landId: number): Promise<{
    approvalPending: boolean;
    approved: boolean;
    seller: string;
  } | null> {
    if (!this.isContractAvailable()) {
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const status = await this.contract!.getSellerApprovalStatus(landId);
      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        approvalPending: status[0] as boolean,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        approved: status[1] as boolean,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        seller: status[2] as string,
      };
    } catch (error) {
      this.logger.error(
        `Error getting seller approval status for land ${landId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Update penalty basis points for refunds
   * @param penaltyBasisPoints - New penalty in basis points (10000 = 100%)
   * @returns Transaction result
   */
  async setPenaltyBasisPoints(
    penaltyBasisPoints: number,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    if (!this.isContractAvailable()) {
      return {
        success: false,
        error: 'Smart contract not available',
      };
    }

    if (penaltyBasisPoints > 10000) {
      return {
        success: false,
        error: 'Penalty cannot exceed 100% (10000 basis points)',
      };
    }

    try {
      const tx = (await this.contract!.setPenaltyBasisPoints(
        penaltyBasisPoints,
      )) as ethers.ContractTransactionResponse;

      this.logger.log(
        `Setting penalty basis points to ${penaltyBasisPoints} (${penaltyBasisPoints / 100}%). Transaction: ${tx.hash}`,
      );

      const receipt = (await tx.wait()) as ethers.ContractTransactionReceipt;

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: 'Transaction failed or reverted',
        };
      }

      this.logger.log(
        `Penalty basis points updated successfully. TX: ${tx.hash}`,
      );

      return {
        success: true,
        transactionHash: tx.hash,
      };
    } catch (error) {
      this.logger.error('Error setting penalty basis points:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
