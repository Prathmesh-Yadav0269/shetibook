import crypto from 'crypto';
import argon2 from 'argon2';
import { getDatabaseClient } from './client.js';
import { runMigrations } from './migrate.js';
import { toSquareMeters } from '../utils/area.js';

export async function seedPhase3Demo() {
  await runMigrations();
  const client = getDatabaseClient();
  const now = new Date().toISOString();

  console.log('[Seed] Seeding Phase 3 demo data...');

  // 1. User
  const phone = '9876543210';
  const existingUser = await client.execute({
    sql: 'SELECT id FROM users WHERE phone_number = ?',
    args: [phone],
  });

  let userId: string;
  if (existingUser.rows.length > 0) {
    userId = String(existingUser.rows[0].id);
  } else {
    userId = crypto.randomUUID();
    const passwordHash = await argon2.hash('Password123!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    const recoveryHash = await argon2.hash('test-recovery-secret', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    await client.execute({
      sql: `INSERT INTO users (id, phone_number, password_hash, recovery_code_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, phone, passwordHash, recoveryHash, now, now],
    });
  }

  // 2. Group
  const existingGroup = await client.execute({
    sql: "SELECT id FROM farming_groups WHERE owner_id = ? AND status = 'active'",
    args: [userId],
  });

  let groupId: string;
  if (existingGroup.rows.length > 0) {
    groupId = String(existingGroup.rows[0].id);
  } else {
    groupId = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO farming_groups (id, name, owner_id, status, created_at, updated_at)
            VALUES (?, ?, ?, 'active', ?, ?)`,
      args: [groupId, 'पाटील कुटुंब शेती (Patil Farm)', userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
            VALUES (?, ?, ?, 'owner', 'active', ?)`,
      args: [crypto.randomUUID(), groupId, userId, now],
    });
  }

  // 3. Farm
  let farmId: string;
  const existingFarms = await client.execute({
    sql: 'SELECT id FROM farms WHERE group_id = ? AND is_active = 1',
    args: [groupId],
  });
  if (existingFarms.rows.length > 0) {
    farmId = String(existingFarms.rows[0].id);
  } else {
    farmId = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO farms (id, group_id, farm_name, village, taluka, district, area_value, area_unit, area_sqm, survey_number, notes, created_by, is_active, created_at, updated_at)
            VALUES (?, ?, 'पाटील मळा', 'हवेली', 'हवेली', 'पुणे', 10, 'acre', ?, '१०२/१', 'बागायती शेत', ?, 1, ?, ?)`,
      args: [farmId, groupId, toSquareMeters(10, 'acre'), userId, now, now],
    });
  }

  // 4. Plots
  let plot1Id: string;
  let plot2Id: string;
  const existingPlots = await client.execute({
    sql: 'SELECT id FROM cultivation_plots WHERE farm_id = ? AND is_active = 1',
    args: [farmId],
  });
  if (existingPlots.rows.length >= 2) {
    plot1Id = String(existingPlots.rows[0].id);
    plot2Id = String(existingPlots.rows[1].id);
  } else {
    plot1Id = crypto.randomUUID();
    plot2Id = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO cultivation_plots (id, farm_id, group_id, plot_name, area_value, area_unit, area_sqm, cultivation_mode, notes, created_by, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 'प्लॉट १ (गहू व सोयाबीन)', 5, 'acre', ?, 'separate', 'काळी कसदार जमीन', ?, 1, ?, ?)`,
      args: [plot1Id, farmId, groupId, toSquareMeters(5, 'acre'), userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO cultivation_plots (id, farm_id, group_id, plot_name, area_value, area_unit, area_sqm, cultivation_mode, notes, created_by, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 'प्लॉट २ (ऊस व कांदा)', 5, 'acre', ?, 'separate', 'ठिबक सिंचन सोय', ?, 1, ?, ?)`,
      args: [plot2Id, farmId, groupId, toSquareMeters(5, 'acre'), userId, now, now],
    });
  }

  // 5. Crops
  let cropWheatId: string;
  let cropSoybeanId: string;
  const existingCrops = await client.execute({
    sql: "SELECT id FROM crops WHERE farm_id = ? AND status != 'cancelled'",
    args: [farmId],
  });
  if (existingCrops.rows.length >= 2) {
    cropWheatId = String(existingCrops.rows[0].id);
    cropSoybeanId = String(existingCrops.rows[1].id);
  } else {
    cropWheatId = crypto.randomUUID();
    cropSoybeanId = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO crops (id, group_id, farm_id, plot_id, crop_type_id, crop_season_id, crop_name_custom, sowing_date, status, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'crop_wheat', 'season_rabi', 'शरबती गहू (Sharbati Wheat)', '2026-10-15', 'active', ?, ?, ?)`,
      args: [cropWheatId, groupId, farmId, plot1Id, userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO crops (id, group_id, farm_id, plot_id, crop_type_id, crop_season_id, crop_name_custom, sowing_date, status, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'crop_soybean', 'season_kharif', 'सोयाबीन जेएस ३३५ (Soybean JS 335)', '2026-06-20', 'harvested', ?, ?, ?)`,
      args: [cropSoybeanId, groupId, farmId, plot1Id, userId, now, now],
    });
  }

  // 6. Custom Category
  const customCatId = 'cat_irrigation_drip';
  await client.execute({
    sql: `INSERT OR IGNORE INTO expense_categories (id, group_id, name_mr, name_en, is_system, is_active, created_at)
          VALUES (?, ?, 'ठिबक सिंचन व पाईप्स', 'Drip Irrigation & Pipes', 0, 1, ?)`,
    args: [customCatId, groupId, now],
  });

  // 7. Clean existing Phase 3 demo records for idempotent re-seed
  await client.execute({ sql: 'DELETE FROM payments WHERE group_id = ?', args: [groupId] });
  await client.execute({ sql: 'DELETE FROM sales WHERE group_id = ?', args: [groupId] });
  await client.execute({ sql: 'DELETE FROM harvests WHERE group_id = ?', args: [groupId] });
  await client.execute({ sql: 'DELETE FROM expense_allocations WHERE group_id = ?', args: [groupId] });
  await client.execute({ sql: 'DELETE FROM expenses WHERE group_id = ?', args: [groupId] });

  // 8. Create Expenses
  // Expense 1: Seeds - ₹4,500 (fully allocated to Wheat, fully paid via UPI)
  const exp1Id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO expenses (id, group_id, farm_id, expense_category_id, amount_paise, expense_date, description, created_by, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 'cat_seeds', 450000, '2026-10-10', 'शरबती गहू बियाणे ३ बॅग खरेदी', ?, 1, ?, ?)`,
    args: [exp1Id, groupId, farmId, userId, now, now],
  });
  await client.execute({
    sql: `INSERT INTO expense_allocations (id, expense_id, crop_id, group_id, amount_paise, created_at)
          VALUES (?, ?, ?, ?, 450000, ?)`,
    args: [crypto.randomUUID(), exp1Id, cropWheatId, groupId, now],
  });
  await client.execute({
    sql: `INSERT INTO payments (id, group_id, expense_id, amount_paise, payment_date, payment_method, reference_number, notes, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 450000, '2026-10-10', 'upi', 'UPI/SEED-98765', 'गूगल पे द्वारे चुकता', ?, ?, ?)`,
    args: [crypto.randomUUID(), groupId, exp1Id, userId, now, now],
  });

  // Expense 2: Fertilizers - ₹12,000 (₹8,000 allocated to Soybean, ₹4,000 general farm; ₹7,000 paid, ₹5,000 balance)
  const exp2Id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO expenses (id, group_id, farm_id, expense_category_id, amount_paise, expense_date, description, created_by, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 'cat_fertilizers', 1200000, '2026-10-25', 'डीएपी आणि १०:२६:२६ खते खरेदी', ?, 1, ?, ?)`,
    args: [exp2Id, groupId, farmId, userId, now, now],
  });
  await client.execute({
    sql: `INSERT INTO expense_allocations (id, expense_id, crop_id, group_id, amount_paise, created_at)
          VALUES (?, ?, ?, ?, 800000, ?)`,
    args: [crypto.randomUUID(), exp2Id, cropSoybeanId, groupId, now],
  });
  await client.execute({
    sql: `INSERT INTO payments (id, group_id, expense_id, amount_paise, payment_date, payment_method, reference_number, notes, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 700000, '2026-10-26', 'cash', NULL, 'दुकानदाराला रोख दिलेले', ?, ?, ?)`,
    args: [crypto.randomUUID(), groupId, exp2Id, userId, now, now],
  });

  // Expense 3: Labour - ₹6,000 (all general farm, unpaid)
  const exp3Id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO expenses (id, group_id, farm_id, expense_category_id, amount_paise, expense_date, description, created_by, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 'cat_labour', 600000, '2026-11-05', 'शेत मशागत व तण काढणी मजुरी', ?, 1, ?, ?)`,
    args: [exp3Id, groupId, farmId, userId, now, now],
  });

  // Expense 4: Drip maintenance (custom category) - ₹3,500 (fully paid via bank transfer)
  const exp4Id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO expenses (id, group_id, farm_id, expense_category_id, amount_paise, expense_date, description, created_by, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, 350000, '2026-11-12', 'ठिबक ड्रिपर्स व लॅटरल पाईप्स बदलणे', ?, 1, ?, ?)`,
    args: [exp4Id, groupId, farmId, customCatId, userId, now, now],
  });
  await client.execute({
    sql: `INSERT INTO payments (id, group_id, expense_id, amount_paise, payment_date, payment_method, reference_number, notes, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 350000, '2026-11-12', 'bank_transfer', 'NEFT-543210', 'बँक ट्रान्सफर', ?, ?, ?)`,
    args: [crypto.randomUUID(), groupId, exp4Id, userId, now, now],
  });

  // 9. Create Harvests
  // Harvest 1: Wheat - 25 quintals
  const h1Id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO harvests (id, group_id, farm_id, crop_id, harvest_date, quantity, unit, notes, created_by, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, '2026-11-15', 25, 'quintal', 'शरबती गहू उच्च प्रतीचे दाणे', ?, 1, ?, ?)`,
    args: [h1Id, groupId, farmId, cropWheatId, userId, now, now],
  });

  // Harvest 2: Soybean - 18 quintals
  const h2Id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO harvests (id, group_id, farm_id, crop_id, harvest_date, quantity, unit, notes, created_by, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, '2026-10-30', 18, 'quintal', 'सोयाबीन मळणी पूर्ण', ?, 1, ?, ?)`,
    args: [h2Id, groupId, farmId, cropSoybeanId, userId, now, now],
  });

  // 10. Create Sales
  // Sale 1: Linked to Wheat harvest - 15 quintals @ ₹2,800/quintal = ₹42,000 (fully paid via bank transfer)
  const sale1Id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO sales (id, group_id, farm_id, crop_id, harvest_id, sale_date, quantity, unit, rate_paise, total_amount_paise, buyer_name, notes, created_by, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, '2026-11-18', 15, 'quintal', 280000, 4200000, 'पुणे कृषी उत्पन्न बाजार समिती (अडत क्र. ४२)', '१५ क्विंटल गहू विक्री', ?, 1, ?, ?)`,
    args: [sale1Id, groupId, farmId, cropWheatId, h1Id, userId, now, now],
  });
  await client.execute({
    sql: `INSERT INTO payments (id, group_id, sale_id, amount_paise, payment_date, payment_method, reference_number, notes, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 4200000, '2026-11-19', 'bank_transfer', 'RTGS-PUNE-8877', 'व्यापाऱ्याने खात्यात जमा केले', ?, ?, ?)`,
    args: [crypto.randomUUID(), groupId, sale1Id, userId, now, now],
  });

  // Sale 2: Linked to Soybean harvest - 12 quintals @ ₹4,500/quintal = ₹54,000 (₹34,000 paid via UPI, ₹20,000 balance due)
  const sale2Id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO sales (id, group_id, farm_id, crop_id, harvest_id, sale_date, quantity, unit, rate_paise, total_amount_paise, buyer_name, notes, created_by, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, '2026-11-02', 12, 'quintal', 450000, 5400000, 'महावीर ऑईल मिल, मंचर', '१२ क्विंटल सोयाबीन विक्री', ?, 1, ?, ?)`,
    args: [sale2Id, groupId, farmId, cropSoybeanId, h2Id, userId, now, now],
  });
  await client.execute({
    sql: `INSERT INTO payments (id, group_id, sale_id, amount_paise, payment_date, payment_method, reference_number, notes, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 3400000, '2026-11-03', 'upi', 'UPI/SOYA-3322', '३४ हजार फोनपे वर जमा, २० हजार बाकी', ?, ?, ?)`,
    args: [crypto.randomUUID(), groupId, sale2Id, userId, now, now],
  });

  // Sale 3: Direct Sale (without harvest) - 4 quintals @ ₹3,000/quintal = ₹12,000 (unpaid, ₹12,000 balance due)
  const sale3Id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO sales (id, group_id, farm_id, crop_id, harvest_id, sale_date, quantity, unit, rate_paise, total_amount_paise, buyer_name, notes, created_by, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, NULL, '2026-11-20', 4, 'quintal', 300000, 1200000, 'स्थानिक किरकोळ व्यापारी (बाजार ओटा)', '४ क्विंटल गहू थेट विक्री', ?, 1, ?, ?)`,
    args: [sale3Id, groupId, farmId, cropWheatId, userId, now, now],
  });

  console.log('[Seed] Phase 3 demo seeding completed successfully!');
  return { groupId, userId };
}

// Run if called directly
if (process.argv[1]?.endsWith('seed_phase3_demo.ts') || process.argv[1]?.endsWith('seed_phase3_demo.js')) {
  seedPhase3Demo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
