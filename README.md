# Land Registration Management System - Backend API

A comprehensive, builder-centric backend API for property registration and management built with **NestJS**, **TypeORM**, **PostgreSQL**, and **Blockchain Integration**.

## 🚀 Features

### Core Features
- **Authentication & Authorization**: JWT-based authentication with role-based access control (Admin, User, Builder)
- **User Management**: Registration, login, profile management, password update, and password reset via email
- **HD Wallet System**: Automatic Ethereum-compatible wallet address generation for each user using HD wallets
- **Builder Management**: Builder registration, verification, and profile management
- **Project Management**: Builders can create and manage property development projects
- **Property Management**: Full CRUD operations for property listings with file upload support
- **File Storage**: Local file storage system with IPFS integration for immutable document storage
- **Email Service**: Password reset emails via Gmail SMTP
- **API Documentation**: Complete Swagger/OpenAPI documentation
- **Database**: PostgreSQL via Neon (serverless PostgreSQL)

### Builder-Centric Features
- **Builder Registration**: Users can register as builders with company and license information
- **Builder Verification**: Admin verification system for builders before they can list properties
- **Project Creation**: Builders create projects and list properties under projects
- **Property Requests**: Buyers can request properties, builders can approve/reject
- **Agreement System**: Digital agreement generation, signing, and blockchain storage
- **Resale Requests**: Property owners can request resale, builders manage listings
- **Timeline-Based Payments**: Flexible installment plans with payment windows
- **Ownership Transfer**: Complete ownership transfer workflow with blockchain verification

### Blockchain Integration
- **Smart Contract Integration**: Ethereum smart contract for land registration and ownership
- **Agreement Storage**: Signed agreements stored as hashes on blockchain
- **Ownership Documents**: Final ownership documents stored on blockchain with IPFS
- **Builder Registry**: Builder license information stored on-chain
- **Payment Verification**: Blockchain-based payment tracking and verification

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- Neon PostgreSQL account (or any PostgreSQL database)
- Gmail account (for email service - optional, can use development mode)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd land-registeration-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and fill in all required values. See [Environment Variables](#-environment-variables) section below for detailed instructions on how to get each value.

4. **Run database migrations** (optional, synchronize is enabled in development)
   ```bash
   # TypeORM will automatically sync schema in development mode
   ```

## 🏃 Running the Application

### Development
```bash
npm run start:dev
# or
pnpm run start:dev
```

The application will start on `http://localhost:3000`

### Production
```bash
npm run build
npm run start:prod
```

### API Documentation (Swagger)

Once the application is running, access the Swagger documentation at:
```
http://localhost:3000/api/docs
```

## 📚 API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/auth/register` | Register a new user (can register as builder) | No | - |
| POST | `/auth/login` | User login | No | - |
| GET | `/auth/me` | Get current user profile | Yes | All |
| PATCH | `/auth/profile` | Update user profile | Yes | All |
| PATCH | `/auth/password` | Update password | Yes | All |
| POST | `/auth/forgot-password` | Request password reset email | No | - |
| POST | `/auth/reset-password` | Reset password with token | No | - |
| POST | `/auth/logout` | Logout user | Yes | All |
| POST | `/auth/builders/:id/verify` | Verify a builder | Yes | Admin |

### Builders (`/api/builders`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/builders/register` | Register as builder (convert user to builder) | Yes | User |
| GET | `/builders/me` | Get builder profile | Yes | Builder |
| PATCH | `/builders/me` | Update builder profile | Yes | Builder |
| GET | `/builders/me/requests` | Get builder's property requests | Yes | Builder |

### Projects (`/api/projects`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/projects` | Create new project | Yes | Builder |
| GET | `/projects` | Get all projects (with filters) | Yes | All |
| GET | `/projects/:id` | Get project by ID | Yes | All |
| PATCH | `/projects/:id` | Update project | Yes | Builder, Admin |
| DELETE | `/projects/:id` | Delete project | Yes | Builder, Admin |

### Properties/Lands (`/api/lands` or `/api/properties`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/lands` | Get all properties (with filters) | Yes | All |
| GET | `/lands/:id` | Get property by ID | Yes | All |
| POST | `/lands` | Create new property (must belong to project) | Yes | Builder |
| PATCH | `/lands/:id` | Update property | Yes | Builder, Admin |
| DELETE | `/lands/:id` | Delete property | Yes | Builder, Admin |

**Query Parameters for GET `/lands`:**
- `status`: Filter by status (available, reserved, agreement_pending, payment_in_progress, owned, resale_listed)
- `projectId`: Filter by project ID
- `builderId`: Filter by builder ID
- `isResale`: Filter resale properties (true/false)
- `minPrice`: Minimum price
- `maxPrice`: Maximum price
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

### Property Requests (`/api/property-requests`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/property-requests` | Create property request | Yes | User |
| GET | `/property-requests` | Get all requests | Yes | Admin |
| GET | `/property-requests/my-requests` | Get my requests | Yes | User |
| GET | `/property-requests/pending` | Get builder's pending requests | Yes | Builder |
| GET | `/property-requests/:id` | Get request by ID | Yes | All |
| POST | `/property-requests/:id/approve` | Approve request | Yes | Builder |
| POST | `/property-requests/:id/reject` | Reject request | Yes | Builder |
| DELETE | `/property-requests/:id` | Cancel request | Yes | User |

### Agreements (`/api/agreements`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/agreements` | Create agreement | Yes | Builder |
| GET | `/agreements` | Get all agreements | Yes | All |
| GET | `/agreements/property/:propertyId` | Get agreements for property | Yes | All |
| GET | `/agreements/:id` | Get agreement by ID | Yes | All |
| POST | `/agreements/:id/sign` | Sign agreement | Yes | Buyer, Builder |
| POST | `/agreements/:id/generate-ownership-doc` | Generate ownership document | Yes | Builder |
| POST | `/agreements/:id/transfer-ownership` | Transfer ownership | Yes | Builder |

### Payments (`/api/payments`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/payments` | Create payment (with agreement/installment) | Yes | User |
| GET | `/payments/my-payments` | Get my payments | Yes | User |
| GET | `/payments/pending` | Get pending payments | Yes | Builder |
| GET | `/payments/property/:propertyId` | Get payments for property | Yes | All |
| GET | `/payments/agreement/:agreementId` | Get payments for agreement | Yes | All |
| GET | `/payments/installment-summary/:propertyId` | Get installment summary | Yes | All |
| POST | `/payments/:id/verify` | Verify payment | Yes | Builder, Admin |

### Installments (`/api/installments`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/installments/from-agreement/:agreementId` | Create installments from agreement | Yes | Builder |
| GET | `/installments` | Get installments (with filters) | Yes | All |
| GET | `/installments/property/:propertyId` | Get installments for property | Yes | All |
| GET | `/installments/:id` | Get installment by ID | Yes | All |

### Resale Requests (`/api/resale-requests`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/resale-requests` | Create resale request | Yes | User |
| GET | `/resale-requests` | Get all requests | Yes | Admin |
| GET | `/resale-requests/my-requests` | Get my resale requests | Yes | User |
| GET | `/resale-requests/builder` | Get builder's resale requests | Yes | Builder |
| GET | `/resale-requests/:id` | Get request by ID | Yes | All |
| POST | `/resale-requests/:id/approve` | Approve resale | Yes | Builder |
| POST | `/resale-requests/:id/list` | List as resale property | Yes | Builder |
| POST | `/resale-requests/:id/reject` | Reject resale | Yes | Builder |
| POST | `/resale-requests/:id/mark-sold` | Mark as sold | Yes | Builder, Admin |

### Reservations (`/api/reservations`) ⚠️ **DEPRECATED**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/reservations` | Create reservation (⚠️ Deprecated - use Property Requests) | Yes | Buyer |
| GET | `/reservations` | Get reservations | Yes | All |
| DELETE | `/reservations/:id` | Cancel reservation | Yes | Owner |

**Note**: Reservations are deprecated. Use Property Requests instead.

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Getting a Token

1. Register a new user:
   ```bash
   POST /api/auth/register
   {
     "name": "John Doe",
     "email": "john@example.com",
     "password": "password123",
     "role": "user"
   }
   ```

2. Or register as a builder:
   ```bash
   POST /api/auth/register
   {
     "name": "ABC Builders",
     "email": "builder@example.com",
     "password": "password123",
     "role": "builder",
     "companyName": "ABC Construction Co.",
     "licenseNumber": "LIC-12345"
   }
   ```

3. Login:
   ```bash
   POST /api/auth/login
   {
     "email": "john@example.com",
     "password": "password123"
   }
   ```

4. Use the token in subsequent requests:
   ```
   Authorization: Bearer <your-jwt-token>
   ```

### User Roles

- **admin**: Full access to all resources, can verify builders, manage all entities
- **user**: Regular users who can request properties, make payments, request resales
- **builder**: Verified builders who can:
  - Create and manage projects
  - List properties under projects
  - Approve/reject property requests
  - Create agreements
  - Verify payments
  - Manage resale requests
  - Transfer ownership after payment completion

### Password Reset Flow

1. User requests password reset: `POST /api/auth/forgot-password`
2. System sends email with reset link (if email service configured)
3. User clicks link: `http://localhost:3000/reset-password?token=abc123...`
4. User submits new password: `POST /api/auth/reset-password`

See `FRONTEND_PASSWORD_RESET_GUIDE.md` for frontend implementation details.

## 📁 Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── dto/
│   ├── strategies/      # JWT strategy
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── builders/            # Builders module
│   ├── dto/
│   ├── builders.controller.ts
│   ├── builders.service.ts
│   └── builders.module.ts
├── projects/            # Projects module
│   ├── dto/
│   ├── projects.controller.ts
│   ├── projects.service.ts
│   └── projects.module.ts
├── lands/               # Properties/Lands module
│   ├── dto/
│   ├── lands.controller.ts
│   ├── lands.service.ts
│   └── lands.module.ts
├── property-requests/   # Property requests module
│   ├── dto/
│   ├── property-requests.controller.ts
│   ├── property-requests.service.ts
│   └── property-requests.module.ts
├── agreements/          # Agreements module
│   ├── dto/
│   ├── agreements.controller.ts
│   ├── agreements.service.ts
│   └── agreements.module.ts
├── resale-requests/     # Resale requests module
│   ├── dto/
│   ├── resale-requests.controller.ts
│   ├── resale-requests.service.ts
│   └── resale-requests.module.ts
├── payments/            # Payments module
│   ├── dto/
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   └── payments.module.ts
├── installments/        # Installments module
│   ├── dto/
│   ├── installments.controller.ts
│   ├── installments.service.ts
│   └── installments.module.ts
├── reservations/        # Reservations module (⚠️ Deprecated)
│   ├── dto/
│   ├── reservations.controller.ts
│   ├── reservations.service.ts
│   └── reservations.module.ts
├── entities/            # TypeORM entities
│   ├── user.entity.ts
│   ├── land.entity.ts
│   ├── project.entity.ts
│   ├── agreement.entity.ts
│   ├── property-request.entity.ts
│   ├── resale-request.entity.ts
│   ├── payment.entity.ts
│   ├── installment.entity.ts
│   ├── installment-plan.entity.ts
│   ├── ownership-history.entity.ts
│   ├── reservation.entity.ts
│   └── password-reset-token.entity.ts
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators (Public, Roles, CurrentUser)
│   ├── guards/          # Auth guards (RolesGuard, BuilderGuard, BuilderVerifiedGuard, PropertyOwnerGuard)
│   ├── filters/         # Exception filters
│   ├── interceptors/    # Response interceptors
│   └── services/       # Shared services
│       ├── file-storage.service.ts
│       ├── ipfs.service.ts
│       ├── hash.service.ts
│       ├── blockchain.service.ts
│       ├── email.service.ts
│       └── wallet.service.ts
├── config/              # Configuration files
│   ├── database.config.ts
│   └── jwt.config.ts
├── app.module.ts        # Root module
└── main.ts              # Application entry point
```

## 🗄️ Database Schema

### User Entity
- id (UUID)
- name (string)
- email (string, unique)
- password (string, hashed)
- role (enum: admin, user, builder)
- walletAddress (string, unique, nullable) - Ethereum-compatible wallet address
- cnic, fatherName, phoneNumber (optional user details)
- **Builder-specific fields:**
  - companyName (string, nullable)
  - licenseNumber (string, unique, nullable)
  - isBuilderVerified (boolean)
  - builderVerifiedAt (timestamp, nullable)
  - verifiedBy (FK to User, nullable)
- createdAt, updatedAt

### Project Entity
- id (UUID)
- name (string)
- description (text, nullable)
- location (text)
- builderId (FK to User)
- status (enum: active, completed, cancelled)
- createdAt, updatedAt

### Land (Property) Entity
- id (UUID)
- title (string)
- location (text)
- size (decimal)
- price (decimal)
- unitId (string, nullable)
- status (enum: available, reserved, agreement_pending, payment_in_progress, owned, resale_listed)
- projectId (FK to Project, nullable)
- builderId (FK to User, nullable)
- ownerId (FK to User, nullable)
- currentOwnerId (FK to User, nullable)
- originalOwnerId (FK to User, nullable)
- installmentPlanYears (integer, nullable)
- totalPaid (decimal, default: 0)
- remainingBalance (decimal, nullable)
- blockchainLandId (integer, nullable)
- documentPath, documentCID, documentIPFSHash (file storage)
- createdAt, updatedAt

### Agreement Entity
- id (UUID)
- propertyId (FK to Land)
- buyerId (FK to User)
- builderId (FK to User)
- type (enum: initial, final_ownership)
- status (enum: draft, pending_signature, signed, completed)
- terms (JSON)
- documentPath, documentCID (signed document storage)
- signedDocumentHash, signedDocumentCID (signed document)
- buyerSignedAt, builderSignedAt (timestamps)
- blockchainTxHash (string, nullable)
- createdAt, updatedAt

### PropertyRequest Entity
- id (UUID)
- propertyId (FK to Land)
- buyerId (FK to User)
- builderId (FK to User)
- status (enum: pending, approved, rejected, cancelled)
- builderResponse (text, nullable)
- createdAt, updatedAt

### ResaleRequest Entity
- id (UUID)
- propertyId (FK to Land)
- ownerId (FK to User)
- builderId (FK to User)
- requestedPrice (decimal)
- status (enum: pending, approved, rejected, listed, sold)
- builderResponse (text, nullable)
- createdAt, updatedAt

### Payment Entity
- id (UUID)
- propertyId (FK to Land)
- agreementId (FK to Agreement, nullable)
- installmentId (FK to Installment, nullable)
- buyerId (FK to User)
- amount (decimal)
- dueDate (date, nullable)
- status (enum: pending, verified, rejected)
- paymentMode (enum: bank, crypto)
- proofPath, proofCID (file storage)
- transactionHash (string, nullable)
- remarks (text, nullable)
- verifiedBy (FK to User, nullable)
- verifiedAt (timestamp, nullable)
- createdAt, updatedAt

### Installment Entity
- id (UUID)
- agreementId (FK to Agreement)
- propertyId (FK to Land)
- amount (decimal)
- paymentWindowStart (date)
- paymentWindowEnd (date)
- paymentDate (date, nullable)
- status (enum: pending, paid, overdue)
- createdAt, updatedAt

### OwnershipHistory Entity
- id (UUID)
- propertyId (FK to Land)
- previousOwnerId (FK to User, nullable)
- newOwnerId (FK to User)
- transferType (enum: purchase, resale, transfer)
- agreementId (FK to Agreement, nullable)
- transferDate (timestamp)
- createdAt

### Reservation Entity (⚠️ Deprecated)
- id (UUID)
- landId (FK to Land)
- buyerId (FK to User)
- status (enum: active, cancelled)
- createdAt, updatedAt

### Password Reset Token Entity
- id (UUID)
- userId (FK to User)
- token (string, hashed)
- expiresAt (timestamp)
- used (boolean)
- createdAt

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📝 Environment Variables

See `.env.example` for a complete template with detailed instructions on how to obtain each value.

### Required Variables

| Variable | Description | How to Get |
|----------|-------------|------------|
| `DATABASE_URL` | Full PostgreSQL connection URL | See [Database Setup](#database-setup) |
| `JWT_SECRET` | Secret key for JWT tokens | Generate with: `openssl rand -base64 32` |
| `EMAIL_HOST` | SMTP server host (for email service) | `smtp.gmail.com` for Gmail |
| `EMAIL_USER` | SMTP username (your email) | Your Gmail address |
| `EMAIL_PASSWORD` | SMTP password (app password) | See [Email Setup](#email-setup) |
| `EMAIL_FROM` | Email sender address | Your Gmail address |
| `FRONTEND_URL` | Frontend URL for reset links | `http://localhost:3000` (or your frontend URL) |
| `BLOCKCHAIN_RPC_URL` | Ethereum RPC endpoint | Infura, Alchemy, or local node URL |
| `BLOCKCHAIN_PRIVATE_KEY` | Admin wallet private key | Admin wallet for contract interactions |
| `CONTRACT_ADDRESS` | Smart contract address | Address after deploying contract |
| `PINATA_API_KEY` | Pinata API key (for IPFS) | Get from [pinata.cloud](https://pinata.cloud) |
| `PINATA_SECRET_KEY` | Pinata secret key | Get from Pinata dashboard |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | Uses `DATABASE_URL` if set |
| `DB_PORT` | Database port | 5432 |
| `DB_USERNAME` | Database username | Uses `DATABASE_URL` if set |
| `DB_PASSWORD` | Database password | Uses `DATABASE_URL` if set |
| `DB_DATABASE` | Database name | postgres |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `PORT` | Application port | 3000 |
| `NODE_ENV` | Environment | development |
| `EMAIL_PORT` | SMTP port | 587 |
| `IPFS_GATEWAY` | IPFS gateway URL | `https://gateway.pinata.cloud/ipfs/` |
| `BLOCKCHAIN_NETWORK` | Blockchain network name | `sepolia` (or `mainnet`, `localhost`) |
| `PAYMENT_TOKEN_ADDRESS` | ERC-20 token address (for payments) | Required if using crypto payments |

### Database Setup

#### Option 1: Neon PostgreSQL (Recommended)

1. Go to [neon.tech](https://neon.tech)
2. Sign up and create a new project
3. Go to **Dashboard** → **Connection Details**
4. Copy the **Connection string** (pooler or direct)
5. Paste it as `DATABASE_URL` in your `.env` file

**Example:**
```env
DATABASE_URL=postgresql://user:password@ep-xxx-xxx-pooler.us-east-1.aws.neon.tech/dbname?sslmode=require
```

#### Option 2: Individual Database Fields

If you prefer individual fields instead of `DATABASE_URL`:

```env
DB_HOST=your-db-host.com
DB_PORT=5432
DB_USERNAME=your-username
DB_PASSWORD=your-password
DB_DATABASE=your-database
```

### Email Setup (Gmail)

1. **Enable 2-Step Verification**
   - Go to: https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select: **App** → Mail, **Device** → Other (Custom name) → `Land Register Backend`
   - Click **Generate**
   - Copy the 16-character password (remove spaces!)

3. **Add to .env**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=abcdefghijklmnop  # 16 chars, no spaces
   EMAIL_FROM=your-email@gmail.com
   FRONTEND_URL=http://localhost:3000
   ```

**Note:** If email is not configured, the system will log emails to console (development mode).

See `GMAIL_SETUP.md` for detailed Gmail setup instructions.

### Blockchain Setup

1. **Get RPC URL:**
   - Option 1: Use Infura
     - Sign up at [infura.io](https://infura.io)
     - Create a project
     - Copy the RPC endpoint URL
   - Option 2: Use Alchemy
     - Sign up at [alchemy.com](https://alchemy.com)
     - Create an app
     - Copy the HTTP URL
   - Option 3: Use local node (for development)
     - Run local Ethereum node (Hardhat, Ganache, etc.)
     - Use `http://localhost:8545`

2. **Get Admin Private Key:**
   - Create a wallet for admin operations
   - Export private key (keep secure!)
   - This wallet will be used for all contract interactions

3. **Deploy Smart Contract:**
   - Compile contract: `npx hardhat compile` (if using Hardhat)
   - Deploy to network
   - Copy contract address after deployment

4. **Add to .env:**
   ```env
   BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
   BLOCKCHAIN_PRIVATE_KEY=0x...your-private-key...
   CONTRACT_ADDRESS=0x...deployed-contract-address...
   BLOCKCHAIN_NETWORK=sepolia
   PAYMENT_TOKEN_ADDRESS=0x...erc20-token-address...  # Optional, for crypto payments
   ```

**Note:** Smart contract must be deployed before using blockchain features. See `smart-contract/smart-contract.sol` for contract source.

### IPFS/Pinata Setup

1. **Sign up for Pinata:**
   - Go to [pinata.cloud](https://pinata.cloud)
   - Create an account
   - Verify your email

2. **Get API Keys:**
   - Go to **Account Settings** → **API Keys**
   - Click **New Key**
   - Give it a name (e.g., "Land Registry Backend")
   - Set permissions:
     - ✅ `pinFileToIPFS`
     - ✅ `pinJSONToIPFS`
     - ✅ `unpin`
     - ✅ `getByCid`
   - Click **Create Key**
   - **Copy both API Key and Secret Key** (secret shown only once!)

3. **Add to .env:**
   ```env
   PINATA_API_KEY=your-api-key-here
   PINATA_SECRET_KEY=your-secret-key-here
   IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/  # Optional, default gateway
   ```

**Note:** If IPFS is not configured, documents will only be stored locally (not on IPFS).

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control (RBAC)
- Input validation with class-validator
- SQL injection prevention (TypeORM parameterized queries)
- CORS configuration
- File upload validation
- Password reset tokens (hashed, with expiry)
- Email-based password recovery

## 📦 Key Dependencies

### Core Framework
- `@nestjs/core`: NestJS framework
- `@nestjs/typeorm`: TypeORM integration
- `@nestjs/passport`: Authentication
- `@nestjs/jwt`: JWT token handling
- `@nestjs/swagger`: API documentation

### Database & ORM
- `typeorm`: ORM for database operations
- `pg`: PostgreSQL driver

### Authentication & Security
- `bcrypt`: Password hashing
- `passport`: Authentication middleware
- `passport-jwt`: JWT strategy for Passport

### File & Storage
- `multer`: File upload handling
- `pinata`: IPFS integration via Pinata

### Blockchain
- `ethers`: Ethereum library for smart contract interactions

### Utilities
- `nodemailer`: Email service
- `class-validator`: Input validation
- `class-transformer`: Object transformation
- `uuid`: UUID generation

## 🔄 Workflows

### Builder Registration & Verification Flow

1. **User registers as builder:**
   ```bash
   POST /api/auth/register
   {
     "role": "builder",
     "companyName": "ABC Construction",
     "licenseNumber": "LIC-12345",
     ...
   }
   ```

2. **Admin verifies builder:**
   ```bash
   POST /api/auth/builders/:id/verify
   ```
   - Builder is marked as verified
   - Builder is registered on blockchain (if wallet exists)

3. **Builder creates project:**
   ```bash
   POST /api/projects
   {
     "name": "Green Valley Phase 1",
     "location": "City Center",
     "description": "Luxury housing project"
   }
   ```

4. **Builder lists properties:**
   ```bash
   POST /api/lands
   {
     "projectId": "uuid",
     "title": "Plot 123",
     "price": 500000,
     ...
   }
   ```

### Property Purchase Flow

1. **Buyer requests property:**
   ```bash
   POST /api/property-requests
   {
     "propertyId": "uuid",
     "message": "Interested in this property"
   }
   ```

2. **Builder approves request:**
   ```bash
   POST /api/property-requests/:id/approve
   ```

3. **Builder creates agreement:**
   ```bash
   POST /api/agreements
   {
     "propertyId": "uuid",
     "buyerId": "uuid",
     "terms": { ... }
   }
   ```

4. **Both parties sign agreement:**
   ```bash
   POST /api/agreements/:id/sign
   ```

5. **Buyer makes payments:**
   ```bash
   POST /api/payments
   {
     "propertyId": "uuid",
     "agreementId": "uuid",
     "installmentId": "uuid",
     "amount": 50000,
     "paymentMode": "bank"
   }
   ```

6. **Builder verifies payment:**
   ```bash
   POST /api/payments/:id/verify
   ```

7. **Builder transfers ownership (after full payment):**
   ```bash
   POST /api/agreements/:id/transfer-ownership
   ```

### Resale Flow

1. **Owner creates resale request:**
   ```bash
   POST /api/resale-requests
   {
     "propertyId": "uuid",
     "requestedPrice": 550000
   }
   ```

2. **Builder approves and lists:**
   ```bash
   POST /api/resale-requests/:id/list
   {
     "listedPrice": 550000
   }
   ```

3. **New buyer follows purchase flow**

## 🚀 Deployment

### Pre-Deployment Checklist

1. **Database:**
   - Create fresh PostgreSQL database
   - Configure `DATABASE_URL` in environment variables

2. **Smart Contract:**
   - Deploy upgraded contract to blockchain network
   - Update `CONTRACT_ADDRESS` in environment variables
   - Ensure `PAYMENT_TOKEN_ADDRESS` is set if using crypto payments

3. **Environment Variables:**
   - Set `NODE_ENV=production`
   - Set secure `JWT_SECRET` (use a strong random string)
   - Configure `BLOCKCHAIN_RPC_URL` and `BLOCKCHAIN_PRIVATE_KEY`
   - Configure IPFS/Pinata credentials (`PINATA_API_KEY`, `PINATA_SECRET_KEY`)
   - Configure email service (Gmail or production SMTP)
   - Set `FRONTEND_URL` to production frontend URL

4. **Application:**
   - Configure CORS origins for production domain
   - Disable TypeORM `synchronize` in production (use migrations)
   - Build application: `npm run build`
   - Deploy compiled code to hosting platform

5. **Security:**
   - Set up proper SSL certificates
   - Secure all environment variables
   - Review and update security configurations

## 📖 API Documentation

Interactive API documentation is available at `/api/docs` when the application is running. The Swagger UI provides:
- Complete endpoint documentation
- Request/response schemas
- Try-it-out functionality
- Authentication testing

## 📚 Additional Documentation

- `UPGRADE_PLAN.md` - Complete upgrade plan and implementation status
- `ARCHITECTURE_FLOW.md` - System architecture and data flow (needs update for builder-centric model)
- `API_DOCUMENTATION.md` - Detailed API documentation
- `WALLET_SETUP.md` - HD Wallet setup and configuration guide
- `FRONTEND_PASSWORD_RESET_GUIDE.md` - Frontend implementation guide for password reset
- `GMAIL_SETUP.md` - Detailed Gmail SMTP setup instructions
- `smart-contract/smart-contract.sol` - Smart contract source code

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the UNLICENSED License.

## 🆘 Support

For support, please open an issue in the repository or contact the development team.

## 🔗 Useful Links

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Neon PostgreSQL](https://neon.tech/docs)
- [Swagger/OpenAPI Documentation](https://swagger.io/docs/)
- [Nodemailer Documentation](https://nodemailer.com/about/)

---

**Last Updated**: December 2024  
**Version**: 2.0.0 (Builder-Centric Architecture)
