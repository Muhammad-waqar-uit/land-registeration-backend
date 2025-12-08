# HD Wallet Setup Guide

## Overview

The application uses **Hierarchical Deterministic (HD) Wallets** to generate unique Ethereum-compatible wallet addresses for each user. All wallets are derived from a single master mnemonic seed phrase.

## How It Works

1. **Master Wallet**: A single master mnemonic seed phrase generates all user wallets
2. **User Wallets**: Each user gets a unique wallet address derived from their user ID
3. **Deterministic**: The same user ID always generates the same wallet address
4. **Secure**: Only the master mnemonic is needed to control all derived wallets

## Wallet Derivation

- **Path Format**: `m/44'/60'/0'/0/{userIdIndex}`
  - `44'` = BIP44 standard
  - `60'` = Ethereum coin type
  - `0'` = Account index
  - `0` = Change index
  - `{userIdIndex}` = Unique index derived from user UUID

## Setup Instructions

### Step 1: Generate Master Mnemonic (First Time)

1. **Start the application** without `MASTER_WALLET_MNEMONIC` in `.env`
2. **Check the logs** - you'll see:
   ```
   ⚠️  NEW MASTER MNEMONIC GENERATED
   ⚠️  Store this mnemonic securely in your .env file as MASTER_WALLET_MNEMONIC
   ⚠️  Mnemonic: word1 word2 word3 ... word12
   ```
3. **Copy the mnemonic** from the logs
4. **Add to `.env`**:
   ```env
   MASTER_WALLET_MNEMONIC=word1 word2 word3 ... word12
   ```
5. **Restart the application**

### Step 2: Use Existing Mnemonic

If you already have a master mnemonic:

```env
MASTER_WALLET_MNEMONIC=your existing twelve word mnemonic phrase here
```

## Security Notes

⚠️ **CRITICAL SECURITY WARNINGS:**

1. **Never commit the mnemonic to git** - It's in `.gitignore` for a reason!
2. **Store securely** - If you lose the mnemonic, you cannot recover user wallets
3. **Backup the mnemonic** - Store it in a secure password manager or hardware wallet
4. **Production**: Use environment variables or secret management service
5. **Master wallet controls all** - Anyone with the mnemonic can control all user wallets

## How User Wallets Are Generated

When a user registers:

1. User is created in database
2. User ID (UUID) is converted to a numeric index
3. Wallet address is derived using BIP44 path
4. Wallet address is stored in `user.walletAddress`
5. Address is returned in registration/login responses

## API Response

User responses now include `walletAddress`:

```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "buyer",
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "createdAt": "2025-12-09T...",
    "updatedAt": "2025-12-09T..."
  },
  "token": "jwt-token-here"
}
```

## Master Wallet Address

The master wallet address is logged on startup. This address can be used to:
- Monitor all transactions
- Fund user wallets (if needed)
- Perform administrative operations

**Note**: The master wallet private key is derived from the mnemonic but is not stored anywhere.

## Troubleshooting

### "Failed to initialize wallet service"
- Check that `MASTER_WALLET_MNEMONIC` is valid (12 or 24 words)
- Ensure mnemonic has no extra spaces or characters
- Verify mnemonic format is correct

### "Failed to generate wallet for user"
- Check logs for detailed error
- Ensure user ID is valid UUID
- Verify database connection

### Wallet address is null
- Check if wallet generation failed (see logs)
- User may have been created before wallet service was added
- Re-generate wallet: Update user record manually or create migration

## Technical Details

- **Library**: `ethers.js` v6+
- **Standard**: BIP44 (Bitcoin Improvement Proposal 44)
- **Coin Type**: 60 (Ethereum)
- **Address Format**: Ethereum-compatible (0x...)
- **Derivation**: Deterministic from user ID

## Migration for Existing Users

If you have existing users without wallet addresses:

1. Create a migration script or use database query
2. For each user, generate wallet using `WalletService.generateWalletFromUserId(userId)`
3. Update `user.walletAddress` field

Example:
```typescript
const walletService = new WalletService(configService);
const { address } = walletService.generateWalletFromUserId(user.id);
user.walletAddress = address;
await userRepository.save(user);
```

## Next Steps

- [ ] Store master mnemonic securely
- [ ] Test wallet generation on user registration
- [ ] Verify wallet addresses are unique
- [ ] Set up monitoring for master wallet
- [ ] Document wallet funding process (if needed)
