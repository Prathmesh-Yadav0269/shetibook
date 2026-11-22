import fs from 'fs';
import path from 'path';

const testDbPath = path.resolve(process.cwd(), 'data', 'test-shetibook.db');
process.env.TURSO_DATABASE_URL = `file:${testDbPath}`;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-32b';

import { beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../src/database/migrate.js';
import { getDatabaseClient, closeDatabaseClient, initDatabaseConnection } from '../src/database/client.js';

beforeAll(async () => {
  // Clean existing test db
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
      if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
      if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    } catch {}
  }

  const client = getDatabaseClient();
  await initDatabaseConnection(client);
  await client.execute('PRAGMA journal_mode = WAL;');
  await runMigrations();
});

afterAll(async () => {
  await closeDatabaseClient();
  await new Promise(resolve => setTimeout(resolve, 300));
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
      if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
      if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    } catch {}
  }
});
