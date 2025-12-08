# Land Registration Management System - Backend API

A comprehensive backend API for land registration and management built with **NestJS**, **TypeORM**, and **Supabase**.

## 🚀 Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control (Admin, Seller, Buyer, Builder)
- **Land Management**: Full CRUD operations for land listings with file upload support
- **Payment Processing**: Payment creation, verification, and tracking with multiple payment modes
- **Reservation System**: Land reservation functionality with status management
- **File Storage**: Integrated Supabase Storage for document management
- **API Documentation**: Complete Swagger/OpenAPI documentation
- **Database**: PostgreSQL via Supabase with TypeORM

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- Supabase account and project
- PostgreSQL database access (via Supabase)

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
   
   Create a `.env` file in the root directory:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://[PROJECT_REF].supabase.co
   SUPABASE_DB_HOST=[PROJECT_REF].supabase.co
   SUPABASE_DB_PORT=5432
   SUPABASE_DB_USERNAME=postgres
   SUPABASE_DB_PASSWORD=[PASSWORD]
   SUPABASE_DB_DATABASE=postgres
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres

   # JWT Configuration
   JWT_SECRET=your-secret-key-here
   JWT_EXPIRES_IN=7d

   # App Configuration
   PORT=3000
   NODE_ENV=development

   # Supabase Storage (for file uploads)
   SUPABASE_STORAGE_BUCKET=land-documents
   SUPABASE_STORAGE_URL=https://[PROJECT_REF].supabase.co/storage/v1
   SUPABASE_ANON_KEY=[ANON_KEY]
   SUPABASE_SERVICE_KEY=[SERVICE_KEY]

   # CORS
   CORS_ORIGIN=http://localhost:3000,http://localhost:3001
   ```

4. **Get Supabase credentials**
   
   - Go to your Supabase project dashboard
   - **Database Connection**: Settings → Database → Connection string
   - **Storage Keys**: Settings → API → Copy Project URL, Anon Key, and Service Role Key
   - Create a storage bucket named `land-documents` in Storage section

5. **Run database migrations** (optional, synchronize is enabled in development)
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
| GET | `/auth/me` | Get current user | Yes |
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

## 📁 Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── dto/             # Data Transfer Objects
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
│   └── reservation.entity.ts
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators
│   ├── guards/          # Auth guards
│   ├── filters/         # Exception filters
│   ├── interceptors/    # Response interceptors
│   └── services/        # Shared services
├── config/              # Configuration files
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── supabase.config.ts
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
- createdAt, updatedAt

### Land Entity
- id (UUID)
- title (string)
- location (text)
- size (decimal)
- price (decimal)
- status (enum: available, locked, sold)
- documentHash, documentCID (for IPFS/storage)
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
- proofCID, transactionHash
- remarks (text)
- createdAt, updatedAt

### Reservation Entity
- id (UUID)
- landId (FK to Land)
- buyerId (FK to User)
- status (enum: active, cancelled)
- createdAt, updatedAt

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_DB_HOST` | Database host | Yes |
| `SUPABASE_DB_PORT` | Database port (default: 5432) | No |
| `SUPABASE_DB_USERNAME` | Database username | Yes |
| `SUPABASE_DB_PASSWORD` | Database password | Yes |
| `SUPABASE_DB_DATABASE` | Database name (default: postgres) | No |
| `DATABASE_URL` | Full database connection URL | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `JWT_EXPIRES_IN` | JWT expiration time (default: 7d) | No |
| `PORT` | Application port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `CORS_ORIGIN` | Allowed CORS origins | No |

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control (RBAC)
- Input validation with class-validator
- SQL injection prevention (TypeORM parameterized queries)
- CORS configuration
- File upload validation

## 📦 Key Dependencies

- `@nestjs/core`: NestJS framework
- `@nestjs/typeorm`: TypeORM integration
- `@nestjs/passport`: Authentication
- `@nestjs/jwt`: JWT token handling
- `typeorm`: ORM for database operations
- `pg`: PostgreSQL driver
- `bcrypt`: Password hashing
- `@supabase/supabase-js`: Supabase client
- `class-validator`: Input validation
- `@nestjs/swagger`: API documentation

## 🚀 Deployment

1. Set `NODE_ENV=production` in your environment
2. Update database connection settings for production
3. Set secure `JWT_SECRET`
4. Configure CORS origins for production domain
5. Disable TypeORM `synchronize` in production (use migrations)
6. Set up proper SSL certificates
7. Configure environment variables on your hosting platform

## 📖 API Documentation

Interactive API documentation is available at `/api/docs` when the application is running. The Swagger UI provides:
- Complete endpoint documentation
- Request/response schemas
- Try-it-out functionality
- Authentication testing

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
- [Supabase Documentation](https://supabase.com/docs)
- [Swagger/OpenAPI Documentation](https://swagger.io/docs/)

---

**Last Updated**: 2024
**Version**: 1.0.0
