import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';

config();

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  // Use DATABASE_URL if provided, otherwise use individual fields
  // Supports both DB_* (Neon) and SUPABASE_DB_* (legacy) variables
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || process.env.SUPABASE_DB_HOST,
        port: parseInt(
          process.env.DB_PORT || process.env.SUPABASE_DB_PORT || '5432',
        ),
        username: process.env.DB_USERNAME || process.env.SUPABASE_DB_USERNAME,
        password: process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD,
        database:
          process.env.DB_DATABASE ||
          process.env.SUPABASE_DB_DATABASE ||
          'postgres',
      }),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
  logging: process.env.NODE_ENV === 'development',
};
