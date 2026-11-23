import crypto from 'crypto';
import argon2 from 'argon2';
import { getDatabaseClient } from './client.js';
import { toSquareMeters } from '../utils/area.js';

export async function seedPhase2Demo() {
  const client = getDatabaseClient();
  const now = new Date().toISOString();

  console.log('[Seed] Seeding Phase 2 demo data...');

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
  const existingFarms = await client.execute({
    sql: 'SELECT id FROM farms WHERE group_id = ? AND is_active = 1',
    args: [groupId],
  });

  let farmId: string;
  if (existingFarms.rows.length > 0) {
    farmId = String(existingFarms.rows[0].id);
  } else {
    farmId = crypto.randomUUID();
    const farmSqm = toSquareMeters(5.5, 'acre');
    await client.execute({
      sql: `INSERT INTO farms (id, group_id, farm_name, village, taluka, district, area_value, area_unit, area_sqm, survey_number, notes, created_by, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [
        farmId,
        groupId,
        'वडिलांचे मुख्य शेत (Main Farm)',
        'बावडा',
        'इंदापूर',
        'पुणे',
        5.5,
        'acre',
        farmSqm,
        '१२४/२ अ',
        'काळ्या कसदार जमिनीचे मुख्य शेत. विहीर व ठिबक सिंचन सोय उपलब्ध.',
        userId,
        now,
        now,
      ],
    });
  }

  // 4. Plots
  const existingPlots = await client.execute({
    sql: 'SELECT id, cultivation_mode FROM cultivation_plots WHERE farm_id = ? AND is_active = 1',
    args: [farmId],
  });

  let plot1Id: string;
  let plot2Id: string;

  if (existingPlots.rows.length >= 2) {
    plot1Id = String(existingPlots.rows[0].id);
    plot2Id = String(existingPlots.rows[1].id);
  } else {
    plot1Id = crypto.randomUUID();
    const plot1Sqm = toSquareMeters(2.0, 'acre');
    await client.execute({
      sql: `INSERT INTO cultivation_plots (id, farm_id, group_id, plot_name, area_value, area_unit, area_sqm, cultivation_mode, notes, created_by, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'separate', ?, ?, 1, ?, ?)`,
      args: [
        plot1Id,
        farmId,
        groupId,
        'प्लॉट १ - विहिरीशेजारील तुकडा',
        2.0,
        'acre',
        plot1Sqm,
        'स्वतंत्र पीक पद्धती. ऊस लागवड.',
        userId,
        now,
        now,
      ],
    });

    plot2Id = crypto.randomUUID();
    const plot2Sqm = toSquareMeters(2.5, 'acre');
    await client.execute({
      sql: `INSERT INTO cultivation_plots (id, farm_id, group_id, plot_name, area_value, area_unit, area_sqm, cultivation_mode, notes, created_by, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'intercropping', ?, ?, 1, ?, ?)`,
      args: [
        plot2Id,
        farmId,
        groupId,
        'प्लॉट २ - माळरानातील आंतरपीक तुकडा',
        2.5,
        'acre',
        plot2Sqm,
        'आंतरपीक पद्धती: सोयाबीन अधिक तूर जोडओळ पद्धत.',
        userId,
        now,
        now,
      ],
    });
  }

  // 5. Crop Types & Seasons lookup
  const cropTypes = await client.execute('SELECT id, crop_name_mr FROM crop_types');
  const cropSeasons = await client.execute('SELECT id, season_name_mr FROM crop_seasons');
  const activityTypes = await client.execute('SELECT id, name_mr FROM activity_types');

  const sugarcaneType = cropTypes.rows.find(r => String(r.crop_name_mr).includes('ऊस')) || cropTypes.rows[0];
  const soybeanType = cropTypes.rows.find(r => String(r.crop_name_mr).includes('सोयाबीन')) || cropTypes.rows[1];
  const turType = cropTypes.rows.find(r => String(r.crop_name_mr).includes('तूर')) || cropTypes.rows[2];
  const kharifSeason = cropSeasons.rows.find(r => String(r.season_name_mr).includes('खरीप')) || cropSeasons.rows[0];

  // 6. Crops
  const existingCrops = await client.execute({
    sql: 'SELECT id FROM crops WHERE farm_id = ?',
    args: [farmId],
  });

  let crop1Id: string;
  let crop2Id: string;

  if (existingCrops.rows.length >= 2) {
    crop1Id = String(existingCrops.rows[0].id);
    crop2Id = String(existingCrops.rows[1].id);
  } else {
    crop1Id = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO crops (id, group_id, farm_id, plot_id, crop_type_id, crop_season_id, crop_name_custom, sowing_date, expected_harvest_date, status, notes, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, '2026-06-15', '2027-05-15', 'active', ?, ?, ?, ?)`,
      args: [
        crop1Id,
        groupId,
        farmId,
        plot1Id,
        String(sugarcaneType.id),
        String(kharifSeason.id),
        'ऊस (को. ८६०३२)',
        'ठिबक सिंचनावर लागवड केलेली आहे.',
        userId,
        now,
        now,
      ],
    });

    crop2Id = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO crops (id, group_id, farm_id, plot_id, crop_type_id, crop_season_id, crop_name_custom, sowing_date, expected_harvest_date, status, notes, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, '2026-06-20', '2026-10-25', 'active', ?, ?, ?, ?)`,
      args: [
        crop2Id,
        groupId,
        farmId,
        plot2Id,
        String(soybeanType.id),
        String(kharifSeason.id),
        'सोयाबीन (जे.एस. ३३५ - आंतरपीक)',
        'तुरीसोबत आंतरपीक.',
        userId,
        now,
        now,
      ],
    });

    const crop3Id = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO crops (id, group_id, farm_id, plot_id, crop_type_id, crop_season_id, crop_name_custom, sowing_date, expected_harvest_date, status, notes, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, '2026-06-20', '2027-01-10', 'active', ?, ?, ?, ?)`,
      args: [
        crop3Id,
        groupId,
        farmId,
        plot2Id,
        String(turType.id),
        String(kharifSeason.id),
        'तूर (बीडीएन ७११ - आंतरपीक)',
        'सोयाबीनच्या ५ ओळींनंतर तुरीची १ ओळ.',
        userId,
        now,
        now,
      ],
    });
  }

  // 7. Activities
  const existingActivities = await client.execute({
    sql: 'SELECT id FROM activities WHERE group_id = ?',
    args: [groupId],
  });

  if (existingActivities.rows.length === 0) {
    const act1Id = crypto.randomUUID();
    const fertType = activityTypes.rows.find(r => String(r.name_mr).includes('खत')) || activityTypes.rows[0];

    await client.execute({
      sql: `INSERT INTO activities (id, group_id, farm_id, plot_id, crop_id, activity_type_id, custom_activity_name, description, status, started_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)`,
      args: [
        act1Id,
        groupId,
        farmId,
        plot1Id,
        crop1Id,
        String(fertType.id),
        'युरिया व डीएपी खताची पहिली मात्रा',
        'ऊस पिकाला पहिली खत मात्रा दिली आणि पाणी सुरू केले.',
        userId,
        now,
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO activity_events (id, activity_id, group_id, actor_id, event_type, event_at, notes)
            VALUES (?, ?, ?, ?, 'created', ?, ?)`,
      args: [crypto.randomUUID(), act1Id, groupId, userId, now, 'काम नोंदवले गेले'],
    });

    await client.execute({
      sql: `INSERT INTO activity_events (id, activity_id, group_id, actor_id, event_type, event_at, notes)
            VALUES (?, ?, ?, ?, 'started', ?, ?)`,
      args: [crypto.randomUUID(), act1Id, groupId, userId, now, 'मजुरांसह प्रत्यक्ष खत टाकणे सुरू केले'],
    });

    const act2Id = crypto.randomUUID();
    const sprayType = activityTypes.rows.find(r => String(r.name_mr).includes('फवारणी')) || activityTypes.rows[1];

    await client.execute({
      sql: `INSERT INTO activities (id, group_id, farm_id, plot_id, crop_id, activity_type_id, custom_activity_name, description, status, started_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
      args: [
        act2Id,
        groupId,
        farmId,
        plot2Id,
        crop2Id,
        String(sprayType.id),
        'सोयाबीनवर कीटकनाशक फवारणी',
        'किडीचा प्रादुर्भाव रोखण्यासाठी शिफारशीत औषधाची फवारणी पूर्ण.',
        userId,
        now,
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO activity_events (id, activity_id, group_id, actor_id, event_type, event_at, notes)
            VALUES (?, ?, ?, ?, 'created', ?, ?)`,
      args: [crypto.randomUUID(), act2Id, groupId, userId, now, 'कामाची पूर्वतयारी'],
    });

    await client.execute({
      sql: `INSERT INTO activity_events (id, activity_id, group_id, actor_id, event_type, event_at, notes)
            VALUES (?, ?, ?, ?, 'started', ?, ?)`,
      args: [crypto.randomUUID(), act2Id, groupId, userId, now, 'सकाळी ७ वाजता फवारणी सुरू'],
    });

    await client.execute({
      sql: `INSERT INTO activity_events (id, activity_id, group_id, actor_id, event_type, event_at, notes)
            VALUES (?, ?, ?, ?, 'completed', ?, ?)`,
      args: [crypto.randomUUID(), act2Id, groupId, userId, now, 'दोन एकर क्षेत्रावर फवारणी यशस्वीरित्या पूर्ण झाली'],
    });
  }

  console.log('[Seed] Phase 2 demo data seeded successfully!');
}

seedPhase2Demo().catch(err => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
