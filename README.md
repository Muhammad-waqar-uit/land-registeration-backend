# Land Registration Management System - Backend API

A comprehensive backend API for land registration and management built with **NestJS**, **TypeORM**, and **Neon PostgreSQL**.

## 🚀 Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control (Admin, Seller, Buyer, Builder)
- **User Management**: Registration, login, profile management, password update, and password reset via email
- **HD Wallet System**: Automatic Ethereum-compatible wallet address generation for each user using HD wallets
- **Land Management**: Full CRUD operations for land listings with file upload support
- **Payment Processing**: Payment creation, verification, and tracking with multiple payment modes
- **Reservation System**: Land reservation functionality with status management
- **File Storage**: Local file storage system for document management
- **Email Service**: Password reset emails via Gmail SMTP
- **API Documentation**: Complete Swagger/OpenAPI documentation
- **Database**: PostgreSQL via Neon (serverless PostgreSQL)

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

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | User login | No |
| GET | `/auth/me` | Get current user profile | Yes |
| PATCH | `/auth/profile` | Update user profile | Yes |
| PATCH | `/auth/password` | Update password | Yes |
| POST | `/auth/forgot-password` | Request password reset email | No |
| POST | `/auth/reset-password` | Reset password with token | No |
| POST | `/auth/logout` | Logout user | Yes |

### Lands (`/api/lands`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/lands` | Get all lands (with filters) | Yes | All |
| GET | `/lands/:id` | Get land by ID | Yes | All |
| POST | `/lands` | Create new land | Yes | Seller, Admin |
| PATCH | `/lands/:id` | Update land | Yes | Owner, Admin |
| DELETE | `/lands/:id` | Delete land | Yes | Owner, Admin |

**Query Parameters for GET `/lands`:**
- `status`: Filter by status (available, locked, sold)
- `ownerId`: Filter by owner ID
- `minPrice`: Minimum price
- `maxPrice`: Maximum price
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

### Payments (`/api/payments`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/payments` | Create payment | Yes | Buyer |
| GET | `/payments/my-payments` | Get my payments | Yes | Buyer |
| GET | `/payments/pending` | Get pending payments | Yes | Builder, Admin |
| POST | `/payments/:id/verify` | Verify payment | Yes | Builder, Admin |

### Reservations (`/api/reservations`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/reservations` | Create reservation | Yes | Buyer |
| GET | `/reservations` | Get reservations | Yes | All |
| DELETE | `/reservations/:id` | Cancel reservation | Yes | Owner |

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Getting a Token

1. Register a new user or login:
   ```bash
   POST /api/auth/register
   {
     "name": "John Doe",
     "email": "john@example.com",
     "password": "password123",
     "role": "buyer"
   }
   ```

2. Use the token in subsequent requests:
   ```
   Authorization: Bearer <your-jwt-token>
   ```

### User Roles

- **admin**: Full access to all resources
- **seller**: Can create/update/delete own lands
- **buyer**: Can view lands, create payments, create reservations
- **builder**: Can verify payments, view all lands

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
│   ├── dto/             # Data Transfer Objects
│   │   ├── forgot-password.dto.ts
│   │   ├── reset-password.dto.ts
│   │   ├── update-password.dto.ts
│   │   └── update-profile.dto.ts
│   ├── strategies/      # JWT strategy
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── lands/               # Lands module
│   ├── dto/
│   ├── lands.controller.ts
│   ├── lands.service.ts
│   └── lands.module.ts
├── payments/            # Payments module
│   ├── dto/
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   └── payments.module.ts
├── reservations/        # Reservations module
│   ├── dto/
│   ├── reservations.controller.ts
│   ├── reservations.service.ts
│   └── reservations.module.ts
├── entities/            # TypeORM entities
│   ├── user.entity.ts
│   ├── land.entity.ts
│   ├── payment.entity.ts
│   ├── reservation.entity.ts
│   └── password-reset-token.entity.ts
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators (Public, Roles)
│   ├── guards/          # Auth guards
│   ├── filters/         # Exception filters
│   ├── interceptors/    # Response interceptors
│   └── services/       # Shared services
│       ├── file-storage.service.ts
│       └── email.service.ts
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
- role (enum: admin, seller, buyer, builder)
- walletAddress (string, unique, nullable) - Ethereum-compatible wallet address
- createdAt, updatedAt

### Land Entity
- id (UUID)
- title (string)
- location (text)
- size (decimal)
- price (decimal)
- status (enum: available, locked, sold)
- documentPath (string, for file storage)
- ownerId (FK to User)
- createdAt, updatedAt

### Payment Entity
- id (UUID)
- landId (FK to Land)
- buyerId (FK to User)
- amount (decimal)
- dueDate (date)
- status (enum: pending, verified, rejected)
- paymentMode (enum: bank, crypto)
- proofPath (string, for file storage)
- transactionHash (string)
- remarks (text, nullable)
- createdAt, updatedAt

### Reservation Entity
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

- `@nestjs/core`: NestJS framework
- `@nestjs/typeorm`: TypeORM integration
- `@nestjs/passport`: Authentication
- `@nestjs/jwt`: JWT token handling
- `typeorm`: ORM for database operations
- `pg`: PostgreSQL driver
- `bcrypt`: Password hashing
- `nodemailer`: Email service
- `class-validator`: Input validation
- `@nestjs/swagger`: API documentation
- `multer`: File upload handling

## 🚀 Deployment

1. Set `NODE_ENV=production` in your environment
2. Update database connection settings for production
3. Set secure `JWT_SECRET` (use a strong random string)
4. Configure CORS origins for production domain
5. Disable TypeORM `synchronize` in production (use migrations)
6. Set up proper SSL certificates
7. Configure environment variables on your hosting platform
8. Set up email service (Gmail or production SMTP service)
9. Configure `FRONTEND_URL` to your production frontend URL

## 📖 API Documentation

Interactive API documentation is available at `/api/docs` when the application is running. The Swagger UI provides:
- Complete endpoint documentation
- Request/response schemas
- Try-it-out functionality
- Authentication testing

## 📚 Additional Documentation

- `FRONTEND_PASSWORD_RESET_GUIDE.md` - Frontend implementation guide for password reset
- `FRONTEND_QUICK_REFERENCE.md` - Quick API reference for frontend developers
- `GMAIL_SETUP.md` - Detailed Gmail SMTP setup instructions
- `GMAIL_TROUBLESHOOTING.md` - Troubleshooting Gmail authentication issues
- `WALLET_SETUP.md` - HD Wallet setup and configuration guide
- `SETUP.md` - Detailed setup guide

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

**Last Updated**: December 2025  
**Version**: 1.0.0
