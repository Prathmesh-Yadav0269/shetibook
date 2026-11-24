-- ShetiBook Phase 3: Financial & Business Management Schema Migration

-- 1. Expense Categories Table
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES farming_groups(id) ON DELETE CASCADE,
  name_mr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK(is_system IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL
);

-- 2. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  expense_category_id TEXT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
  expense_date TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Expense Allocations Table (Crop-level expense division)
CREATE TABLE IF NOT EXISTS expense_allocations (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  crop_id TEXT NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
  created_at TEXT NOT NULL,
  UNIQUE(expense_id, crop_id)
);

-- 4. Harvests Table (Agricultural production recording)
CREATE TABLE IF NOT EXISTS harvests (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  crop_id TEXT NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  harvest_date TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit TEXT NOT NULL CHECK(unit IN ('kg', 'quintal', 'tonne')),
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Sales Table (Direct or Harvest-linked produce sales)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE RESTRICT,
  crop_id TEXT NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
  harvest_id TEXT REFERENCES harvests(id) ON DELETE RESTRICT,
  sale_date TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit TEXT NOT NULL CHECK(unit IN ('kg', 'quintal', 'tonne')),
  rate_paise INTEGER NOT NULL CHECK(rate_paise > 0),
  total_amount_paise INTEGER NOT NULL CHECK(total_amount_paise > 0),
  buyer_name TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Payments Table (Shared payment records for expenses & sales)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE RESTRICT,
  expense_id TEXT REFERENCES expenses(id) ON DELETE CASCADE,
  sale_id TEXT REFERENCES sales(id) ON DELETE CASCADE,
  amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'upi', 'bank_transfer', 'credit', 'other')),
  reference_number TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (expense_id IS NOT NULL AND sale_id IS NULL) OR
    (expense_id IS NULL AND sale_id IS NOT NULL)
  )
);

-- 7. Performance & Multi-Tenant Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_expense_categories_group ON expense_categories(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group_farm ON expenses(group_id, farm_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_allocations_expense ON expense_allocations(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_allocations_crop ON expense_allocations(crop_id);
CREATE INDEX IF NOT EXISTS idx_harvests_group_crop ON harvests(group_id, crop_id);
CREATE INDEX IF NOT EXISTS idx_harvests_farm ON harvests(farm_id);
CREATE INDEX IF NOT EXISTS idx_sales_group_crop ON sales(group_id, crop_id);
CREATE INDEX IF NOT EXISTS idx_sales_harvest ON sales(harvest_id);
CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id);
CREATE INDEX IF NOT EXISTS idx_payments_expense ON payments(expense_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

-- 8. Seed Predefined Expense Categories (10 standard categories)
INSERT OR IGNORE INTO expense_categories (id, group_id, name_mr, name_en, is_system, is_active, created_at)
VALUES 
  ('cat_seeds', NULL, 'बियाणे', 'Seeds', 1, 1, '2026-01-01T00:00:00.000Z'),
  ('cat_fertilizers', NULL, 'खते', 'Fertilizers', 1, 1, '2026-01-01T00:00:00.000Z'),
  ('cat_pesticides', NULL, 'कीटकनाशके व फवारणी', 'Pesticides / Spraying', 1, 1, '2026-01-01T00:00:00.000Z'),
  ('cat_labour', NULL, 'मजुरी', 'Labour', 1, 1, '2026-01-01T00:00:00.000Z'),
  ('cat_machinery', NULL, 'यंत्रसामग्री व अवजारे भाडे', 'Machinery / Equipment Hire', 1, 1, '2026-01-01T00:00:00.000Z'),
  ('cat_irrigation', NULL, 'पाणी व्यवस्थापन / वीज', 'Irrigation / Electricity', 1, 1, '2026-01-01T00:00:00.000Z'),
  ('cat_fuel', NULL, 'इंधन / डिझेल', 'Fuel / Diesel', 1, 1, '2026-01-01T00:00:00.000Z'),
  ('cat_repairs', NULL, 'दुरुस्ती व देखभाल', 'Repairs & Maintenance', 1, 1, '2026-01-01T00:00:00.000Z'),
  ('cat_transport', NULL, 'वाहतूक खर्च', 'Transport', 1, 1, '2026-01-01T00:00:00.000Z'),
  ('cat_other', NULL, 'इतर खर्च', 'Other / Miscellaneous', 1, 1, '2026-01-01T00:00:00.000Z');
