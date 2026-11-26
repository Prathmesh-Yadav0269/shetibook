import { getDatabaseClient, initDatabaseConnection } from '../server/dist/database/client.js';
import { runMigrations } from '../server/dist/database/migrate.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

async function runBackupRestoreDrill() {
  console.log('[Gate 8 Drill] Starting Database Backup & Restore Drill...');

  const dataDir = path.resolve('data');
  const sourceDbPath = path.join(dataDir, 'drill_source.db');
  const backupDbPath = path.join(dataDir, 'drill_backup.db');
  const restoredDbPath = path.join(dataDir, 'drill_restored.db');
  const evidencePath = path.resolve('docs', 'verification', 'phase-5', 'database_backup_drill.json');

  // Clean previous drill files
  [sourceDbPath, backupDbPath, restoredDbPath].forEach((p) => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  const sourceUrl = `file:${sourceDbPath}`;
  const restoredUrl = `file:${restoredDbPath}`;

  const drillReport = {
    timestamp: new Date().toISOString(),
    sourceDatabase: sourceDbPath,
    backupFile: backupDbPath,
    restoredDatabase: restoredDbPath,
    stages: [],
  };

  try {
    // 1. Run migrations on source
    console.log('[Gate 8 Drill] Stage 1: Applying migrations to fresh source database...');
    await runMigrations(sourceUrl);
    const sourceClient = getDatabaseClient(sourceUrl);
    await initDatabaseConnection(sourceClient);

    // 2. Insert test data
    console.log('[Gate 8 Drill] Stage 2: Seeding relational multi-tenant records into source...');
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const groupId = crypto.randomUUID();
    const farmId = crypto.randomUUID();
    const plotId = crypto.randomUUID();
    const cropId = crypto.randomUUID();
    const expenseId = crypto.randomUUID();
    const allocId = crypto.randomUUID();

    await sourceClient.execute({
      sql: `INSERT INTO users (id, phone_number, password_hash, recovery_code_hash, status, created_at, updated_at)
            VALUES (?, '9876500001', 'argon2_hash', 'rec_hash', 'active', ?, ?)`,
      args: [userId, now, now],
    });
    await sourceClient.execute({
      sql: `INSERT INTO farming_groups (id, name, owner_id, status, created_at, updated_at)
            VALUES (?, 'बॅकअप चाचणी शेती गट (Backup Test Group)', ?, 'active', ?, ?)`,
      args: [groupId, userId, now, now],
    });
    await sourceClient.execute({
      sql: `INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
            VALUES (?, ?, ?, 'owner', 'active', ?)`,
      args: [crypto.randomUUID(), groupId, userId, now],
    });
    await sourceClient.execute({
      sql: `INSERT INTO farms (id, group_id, farm_name, village, area_value, area_unit, area_sqm, is_active, created_by, created_at, updated_at)
            VALUES (?, ?, 'मळा क्रमांक १', 'बारामती', 5.0, 'acre', 20234.0, 1, ?, ?, ?)`,
      args: [farmId, groupId, userId, now, now],
    });
    await sourceClient.execute({
      sql: `INSERT INTO cultivation_plots (id, farm_id, group_id, plot_name, area_value, area_unit, area_sqm, cultivation_mode, is_active, created_by, created_at, updated_at)
            VALUES (?, ?, ?, 'तुकडा १', 5.0, 'acre', 20234.0, 'separate', 1, ?, ?, ?)`,
      args: [plotId, farmId, groupId, userId, now, now],
    });
    await sourceClient.execute({
      sql: `INSERT INTO crops (id, group_id, farm_id, plot_id, crop_type_id, crop_season_id, sowing_date, status, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'crop_sugarcane', 'season_kharif', '2026-06-01', 'active', ?, ?, ?)`,
      args: [cropId, groupId, farmId, plotId, userId, now, now],
    });
    await sourceClient.execute({
      sql: `INSERT INTO expenses (id, group_id, farm_id, expense_category_id, amount_paise, expense_date, description, created_by, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 'cat_fertilizers', 500000, '2026-07-01', 'खत खरेदी', ?, 1, ?, ?)`,
      args: [expenseId, groupId, farmId, userId, now, now],
    });
    await sourceClient.execute({
      sql: `INSERT INTO expense_allocations (id, expense_id, group_id, crop_id, amount_paise, created_at)
            VALUES (?, ?, ?, ?, 500000, ?)`,
      args: [allocId, expenseId, groupId, cropId, now],
    });

    drillReport.stages.push({
      stage: 'Source Database Seeding',
      passed: true,
      recordsInserted: { users: 1, groups: 1, farms: 1, crops: 1, expenses: 1, allocations: 1 },
    });

    // 3. Perform Backup
    console.log('[Gate 8 Drill] Stage 3: Performing cold binary database backup...');
    fs.copyFileSync(sourceDbPath, backupDbPath);
    const backupStat = fs.statSync(backupDbPath);
    drillReport.stages.push({
      stage: 'Database Backup Creation',
      passed: fs.existsSync(backupDbPath) && backupStat.size > 0,
      backupSizeBytes: backupStat.size,
    });

    // 4. Perform Restore to a fresh target
    console.log('[Gate 8 Drill] Stage 4: Restoring database from backup into clean location...');
    fs.copyFileSync(backupDbPath, restoredDbPath);
    drillReport.stages.push({
      stage: 'Database Restoration',
      passed: fs.existsSync(restoredDbPath),
    });

    // 5. Connect to restored database and verify integrity
    console.log('[Gate 8 Drill] Stage 5: Validating restored database integrity and schema constraints...');
    const restoredClient = getDatabaseClient(restoredUrl);
    await initDatabaseConnection(restoredClient);

    // PRAGMA integrity_check
    const integrityRes = await restoredClient.execute('PRAGMA integrity_check;');
    const isIntegrityOk = String(integrityRes.rows[0].integrity_check) === 'ok';

    // PRAGMA foreign_key_check
    const fkRes = await restoredClient.execute('PRAGMA foreign_key_check;');
    const zeroFkViolations = fkRes.rows.length === 0;

    // Verify record counts
    const userCount = await restoredClient.execute('SELECT COUNT(*) as c FROM users;');
    const groupCount = await restoredClient.execute('SELECT COUNT(*) as c FROM farming_groups;');
    const farmCount = await restoredClient.execute('SELECT COUNT(*) as c FROM farms;');
    const cropCount = await restoredClient.execute('SELECT COUNT(*) as c FROM crops;');
    const expCount = await restoredClient.execute('SELECT COUNT(*) as c FROM expenses;');
    const allocCount = await restoredClient.execute('SELECT COUNT(*) as c FROM expense_allocations;');

    const recordsIntact =
      Number(userCount.rows[0].c) === 1 &&
      Number(groupCount.rows[0].c) === 1 &&
      Number(farmCount.rows[0].c) === 1 &&
      Number(cropCount.rows[0].c) === 1 &&
      Number(expCount.rows[0].c) === 1 &&
      Number(allocCount.rows[0].c) === 1;

    // Verify relational join
    const joinRes = await restoredClient.execute(`
      SELECT e.amount_paise, ea.amount_paise as alloc_paise, c.sowing_date, f.farm_name
      FROM expenses e
      JOIN expense_allocations ea ON ea.expense_id = e.id
      JOIN crops c ON c.id = ea.crop_id
      JOIN farms f ON f.id = e.farm_id
      WHERE e.id = ?
    `, [expenseId]);
    const relationalIntegrityOk = joinRes.rows.length === 1 && Number(joinRes.rows[0].alloc_paise) === 500000;

    drillReport.stages.push({
      stage: 'Restored Database Integrity & Foreign Key Verification',
      passed: isIntegrityOk && zeroFkViolations && recordsIntact && relationalIntegrityOk,
      details: {
        integrityCheck: isIntegrityOk ? 'ok' : 'FAILED',
        foreignKeyViolations: fkRes.rows.length,
        recordsIntact,
        relationalJoinValidated: relationalIntegrityOk,
      },
    });

    console.log('[Gate 8 Drill Results]', drillReport.stages);
  } finally {
    // Cleanup temporary drill database files
    [sourceDbPath, backupDbPath, restoredDbPath].forEach((p) => {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (e) {}
    });
  }

  fs.writeFileSync(evidencePath, JSON.stringify(drillReport, null, 2));
  console.log('[Gate 8 Complete] Evidence saved to:', evidencePath);

  const allPassed = drillReport.stages.every((s) => s.passed);
  console.log('[Gate 8 Overall Status]:', allPassed ? 'PASS' : 'FAIL');
  return allPassed;
}

runBackupRestoreDrill()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((err) => {
    console.error('Backup restore drill failed:', err);
    process.exit(1);
  });
