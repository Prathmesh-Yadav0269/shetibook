import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Database
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || 'file:./data/shetibook.db',
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || '',

  // Auth & Session
  SESSION_SECRET: process.env.SESSION_SECRET || 'shetibook-default-dev-secret-key-32b',
  SESSION_COOKIE_NAME: 'sb_session',
  SESSION_EXPIRY_DAYS: 30,

  // CORS & Security
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:3000',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200', 10),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10), // 10 attempts per window
};
