import { createClient, Client } from '@libsql/client';
import { config } from '../config/index.js';
import path from 'path';
import fs from 'fs';

let dbInstance: Client | null = null;
let currentDbUrl: string | null = null;

export function getDatabaseClient(customUrl?: string, customToken?: string): Client {
  const targetUrl = customUrl || process.env.TURSO_DATABASE_URL || config.TURSO_DATABASE_URL;
  const targetToken = customToken || process.env.TURSO_AUTH_TOKEN || config.TURSO_AUTH_TOKEN;

  if (dbInstance && currentDbUrl === targetUrl && !customUrl) {
    return dbInstance;
  }

  // If local file database, ensure directory exists
  if (targetUrl.startsWith('file:')) {
    const filePath = targetUrl.replace('file:', '');
    if (filePath !== ':memory:' && !filePath.startsWith(':memory:')) {
      const dir = path.dirname(path.resolve(process.cwd(), filePath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  const client = createClient({
    url: targetUrl,
    authToken: targetToken ? targetToken : undefined,
  });

  if (!customUrl) {
    dbInstance = client;
    currentDbUrl = targetUrl;
  }

  return client;
}

export async function initDatabaseConnection(client: Client): Promise<void> {
  // Always enable foreign keys in SQLite/Turso
  await client.execute('PRAGMA foreign_keys = ON;');
}

export async function closeDatabaseClient(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    currentDbUrl = null;
  }
}
