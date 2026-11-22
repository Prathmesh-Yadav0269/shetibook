import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabaseClient, initDatabaseConnection } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(customUrl?: string, customToken?: string) {
  const client = getDatabaseClient(customUrl, customToken);
  await initDatabaseConnection(client);

  // Ensure migrations tracking table exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedResult = await client.execute('SELECT name FROM schema_migrations ORDER BY id ASC;');
  const appliedNames = new Set(appliedResult.rows.map(r => String(r.name)));

  const migrationsDir = path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[Migrations] Directory not found:', migrationsDir);
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    if (appliedNames.has(file)) {
      continue;
    }

    console.log(`[Migrations] Applying: ${file}...`);
    const sqlPath = path.join(migrationsDir, file);
    const sqlRaw = fs.readFileSync(sqlPath, 'utf-8');

    // Remove single line SQL comments
    const sqlClean = sqlRaw
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('--') ? '' : line;
      })
      .join('\n');

    // Split SQL statements by semicolon, avoiding empty statements
    const statements = sqlClean
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await client.execute(stmt);
    }

    await client.execute({
      sql: 'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?);',
      args: [file, new Date().toISOString()]
    });

    console.log(`[Migrations] Successfully applied: ${file}`);
  }

  console.log('[Migrations] Database is up to date.');
}

// If run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
