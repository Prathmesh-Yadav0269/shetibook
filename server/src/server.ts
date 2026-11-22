import { app } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { getDatabaseClient, initDatabaseConnection } from './database/client.js';
import { runMigrations } from './database/migrate.js';

async function bootstrap() {
  try {
    logger.info('Initializing ShetiBook server...');
    const dbClient = getDatabaseClient();
    await initDatabaseConnection(dbClient);
    
    // Auto-apply migrations on startup
    await runMigrations();

    app.listen(config.PORT, () => {
      logger.info(`ShetiBook Server listening on port ${config.PORT} [${config.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Failed to start server:', { error: (err as Error).message });
    process.exit(1);
  }
}

bootstrap();
