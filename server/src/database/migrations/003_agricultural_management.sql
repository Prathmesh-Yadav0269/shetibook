-- ShetiBook Phase 2: Farm & Agricultural Management Schema Migration

-- 1. Farms Table
CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  farm_name TEXT NOT NULL,
  village TEXT NOT NULL,
  taluka TEXT,
  district TEXT,
  area_value REAL NOT NULL CHECK(area_value > 0),
  area_unit TEXT NOT NULL CHECK(area_unit IN ('acre', 'guntha', 'hectare')),
  area_sqm REAL NOT NULL CHECK(area_sqm > 0),
  survey_number TEXT,
  latitude REAL,
  longitude REAL,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
);

-- 2. Cultivation Plots Table
CREATE TABLE IF NOT EXISTS cultivation_plots (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  plot_name TEXT NOT NULL,
  area_value REAL NOT NULL CHECK(area_value > 0),
  area_unit TEXT NOT NULL CHECK(area_unit IN ('acre', 'guntha', 'hectare')),
  area_sqm REAL NOT NULL CHECK(area_sqm > 0),
  cultivation_mode TEXT NOT NULL CHECK(cultivation_mode IN ('separate', 'intercropping')),
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
);

-- 3. Crop Types Table (Seedable & Manageable)
CREATE TABLE IF NOT EXISTS crop_types (
  id TEXT PRIMARY KEY,
  crop_name_mr TEXT NOT NULL,
  crop_name_en TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL
);

-- 4. Crop Seasons Table
CREATE TABLE IF NOT EXISTS crop_seasons (
  id TEXT PRIMARY KEY,
  season_name_mr TEXT NOT NULL,
  season_name_en TEXT NOT NULL,
  start_month INTEGER CHECK(start_month BETWEEN 1 AND 12),
  end_month INTEGER CHECK(end_month BETWEEN 1 AND 12),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
);

-- 5. Crops Table
CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  plot_id TEXT NOT NULL REFERENCES cultivation_plots(id) ON DELETE RESTRICT,
  crop_type_id TEXT NOT NULL REFERENCES crop_types(id) ON DELETE RESTRICT,
  crop_season_id TEXT NOT NULL REFERENCES crop_seasons(id) ON DELETE RESTRICT,
  crop_name_custom TEXT,
  sowing_date TEXT NOT NULL,
  expected_harvest_date TEXT,
  actual_harvest_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'harvested', 'cancelled')),
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Activity Types Table
CREATE TABLE IF NOT EXISTS activity_types (
  id TEXT PRIMARY KEY,
  name_mr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL
);

-- 7. Activities Table
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  plot_id TEXT REFERENCES cultivation_plots(id) ON DELETE RESTRICT,
  crop_id TEXT REFERENCES crops(id) ON DELETE RESTRICT,
  activity_type_id TEXT NOT NULL REFERENCES activity_types(id) ON DELETE RESTRICT,
  custom_activity_name TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'paused', 'completed')),
  started_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 8. Activity Events (Append-only Audit for Activities)
CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('created', 'started', 'paused', 'resumed', 'completed', 'cancelled')),
  event_at TEXT NOT NULL,
  notes TEXT
);

-- Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_farms_group ON farms(group_id, is_active);
CREATE INDEX IF NOT EXISTS idx_plots_farm ON cultivation_plots(farm_id, is_active);
CREATE INDEX IF NOT EXISTS idx_plots_group ON cultivation_plots(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plots_unique_active_name ON cultivation_plots(farm_id, plot_name) WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_crops_plot ON crops(plot_id, status);
CREATE INDEX IF NOT EXISTS idx_crops_farm ON crops(farm_id);
CREATE INDEX IF NOT EXISTS idx_crops_group ON crops(group_id);

CREATE INDEX IF NOT EXISTS idx_activities_farm ON activities(farm_id, status);
CREATE INDEX IF NOT EXISTS idx_activities_crop ON activities(crop_id);
CREATE INDEX IF NOT EXISTS idx_activities_group ON activities(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_activity ON activity_events(activity_id, event_at);

-- Initial Seed Data: Common Maharashtra Crops
INSERT OR IGNORE INTO crop_types (id, crop_name_mr, crop_name_en, is_active, created_at) VALUES
  ('crop_sugarcane', 'ऊस', 'Sugarcane', 1, datetime('now')),
  ('crop_soybean', 'सोयाबीन', 'Soybean', 1, datetime('now')),
  ('crop_rice', 'भात', 'Rice', 1, datetime('now')),
  ('crop_sorghum', 'ज्वारी', 'Sorghum', 1, datetime('now')),
  ('crop_maize', 'मका', 'Maize', 1, datetime('now')),
  ('crop_wheat', 'गहू', 'Wheat', 1, datetime('now')),
  ('crop_chickpea', 'हरभरा', 'Chickpea', 1, datetime('now')),
  ('crop_groundnut', 'भुईमूग', 'Groundnut', 1, datetime('now')),
  ('crop_turmeric', 'हळद', 'Turmeric', 1, datetime('now')),
  ('crop_onion', 'कांदा', 'Onion', 1, datetime('now')),
  ('crop_cotton', 'कापूस', 'Cotton', 1, datetime('now'));

-- Initial Seed Data: Agricultural Seasons
INSERT OR IGNORE INTO crop_seasons (id, season_name_mr, season_name_en, start_month, end_month, is_active) VALUES
  ('season_kharif', 'खरीप', 'Kharif', 6, 10, 1),
  ('season_rabi', 'रब्बी', 'Rabi', 10, 3, 1),
  ('season_summer', 'उन्हाळी', 'Summer', 3, 6, 1),
  ('season_perennial', 'बारमाही', 'Perennial', 1, 12, 1);

-- Initial Seed Data: Common Agricultural Activity Types
INSERT OR IGNORE INTO activity_types (id, name_mr, name_en, is_active, created_at) VALUES
  ('act_irrigation', 'पाणी देणे', 'Irrigation', 1, datetime('now')),
  ('act_fertilizer', 'खत टाकणे', 'Fertilizer application', 1, datetime('now')),
  ('act_weeding', 'तण काढणे', 'Weeding', 1, datetime('now')),
  ('act_spraying', 'फवारणी', 'Spraying', 1, datetime('now')),
  ('act_ploughing', 'नांगरणी', 'Ploughing', 1, datetime('now')),
  ('act_other', 'इतर', 'Other', 1, datetime('now'));
