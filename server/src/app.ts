import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/error.middleware.js';
import { csrfProtection } from './middleware/csrf.middleware.js';
import { authRouter } from './modules/auth/index.js';
import { usersRouter } from './modules/users/users.routes.js';
import { familyRouter } from './modules/family/family.routes.js';
import { getDatabaseClient } from './database/client.js';

export const app = express();

// Trust proxy in production (e.g. Render, reverse proxies)
if (config.isProduction) {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet());

// CORS configuration - strict, no wildcard with credentials
app.use(
  cors({
    origin: config.CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Protection'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(globalLimiter);

// Health check endpoint - public without exposing credentials
app.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    const client = getDatabaseClient();
    const result = await client.execute('SELECT 1 as alive;');
    if (result.rows.length > 0) {
      dbStatus = 'connected';
    }
  } catch {
    dbStatus = 'error';
  }

  res.status(200).json({
    status: 'ok',
    service: 'shetibook-api',
    version: '1.0.0',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// CSRF & Origin protection on all mutating API requests
app.use(csrfProtection);

// API v1 Modules
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/groups', familyRouter);

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API route not found.',
    },
  });
});

// Centralized error handler
app.use(errorHandler);
