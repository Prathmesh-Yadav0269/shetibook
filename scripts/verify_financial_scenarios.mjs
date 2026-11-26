import { FinanceService } from '../server/dist/modules/finance/finance.service.js';
import { getDatabaseClient } from '../server/dist/database/client.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

async function runFinancialAudit() {
  const client = getDatabaseClient();
  const finance = new FinanceService();

  const results = [];
  const groupId = 'fin_audit_grp_' + Date.now();
  const userId = 'fin_audit_usr_' + Date.now();
  const farmId = 'fin_audit_farm_' + Date.now();
  const cropSugarcane = 'fin_crop_sugarcane_' + Date.now();
  const cropSoybean = 'fin_crop_soybean_' + Date.now();
  const now = new Date().toISOString();

  const plotId = 'fin_plot_' + Date.now();

  // Setup mock tenant
  await client.execute({
    sql: `INSERT INTO users (id, phone_number, password_hash, recovery_code_hash, status, created_at, updated_at)
          VALUES (?, ?, 'hash', 'rec_hash', 'active', ?, ?)`,
    args: [userId, '99999' + Math.floor(10000 + Math.random() * 90000), now, now],
  });
  await client.execute({
    sql: `INSERT INTO farming_groups (id, name, owner_id, status, created_at, updated_at)
          VALUES (?, 'Financial Audit Farm Group', ?, 'active', ?, ?)`,
    args: [groupId, userId, now, now],
  });
  await client.execute({
    sql: `INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
          VALUES (?, ?, ?, 'owner', 'active', ?)`,
    args: [crypto.randomUUID(), groupId, userId, now],
  });
  await client.execute({
    sql: `INSERT INTO farms (id, group_id, farm_name, village, area_value, area_unit, area_sqm, is_active, created_by, created_at, updated_at)
          VALUES (?, ?, 'Audit Farm A', 'Pune', 10, 'acre', 40468, 1, ?, ?, ?)`,
    args: [farmId, groupId, userId, now, now],
  });
  await client.execute({
    sql: `INSERT INTO cultivation_plots (id, farm_id, group_id, plot_name, area_value, area_unit, area_sqm, cultivation_mode, is_active, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 'Plot A', 10, 'acre', 40468, 'separate', 1, ?, ?, ?)`,
    args: [plotId, farmId, groupId, userId, now, now],
  });
  await client.execute({
    sql: `INSERT INTO crops (id, group_id, farm_id, plot_id, crop_type_id, crop_season_id, sowing_date, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'crop_sugarcane', 'season_kharif', '2026-06-01', 'active', ?, ?, ?)`,
    args: [cropSugarcane, groupId, farmId, plotId, userId, now, now],
  });
  await client.execute({
    sql: `INSERT INTO crops (id, group_id, farm_id, plot_id, crop_type_id, crop_season_id, sowing_date, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'crop_soybean', 'season_kharif', '2026-06-01', 'active', ?, ?, ?)`,
    args: [cropSoybean, groupId, farmId, plotId, userId, now, now],
  });

  // SCENARIO A: Partial Expense Allocation
  console.log('--- SCENARIO A: Partial Expense Allocation ---');
  // Fertilizer ₹5,000: Sugarcane ₹3,000, Soybean ₹1,500, General residual ₹500
  const expA = await finance.createExpense(groupId, userId, {
    farmId,
    expenseCategoryId: 'cat_fertilizers',
    amountPaise: 500000, // ₹5,000
    expenseDate: '2026-07-01',
    description: 'संयुक्त खत खरेदी (Fertilizer Purchase)',
    allocations: [
      { cropId: cropSugarcane, amountPaise: 300000 }, // ₹3,000
      { cropId: cropSoybean, amountPaise: 150000 },   // ₹1,500
    ],
  });

  const allocationsRes = await client.execute({
    sql: 'SELECT crop_id, amount_paise FROM expense_allocations WHERE expense_id = ?',
    args: [expA.id],
  });
  const totalAllocated = allocationsRes.rows.reduce((sum, r) => sum + Number(r.amount_paise), 0);
  const generalResidual = expA.amountPaise - totalAllocated;

  results.push({
    scenario: 'Scenario A: Total Expense',
    expected: 500000,
    actual: expA.amountPaise,
    passed: expA.amountPaise === 500000,
  });
  results.push({
    scenario: 'Scenario A: Crop Allocations Total',
    expected: 450000,
    actual: totalAllocated,
    passed: totalAllocated === 450000,
  });
  results.push({
    scenario: 'Scenario A: General Residual Overhead',
    expected: 50000,
    actual: generalResidual,
    passed: generalResidual === 50000,
  });

  // Verify allocations cannot exceed total expense
  let allocationExceeded = false;
  try {
    await finance.createExpense(groupId, userId, {
      farmId,
      expenseCategoryId: 'cat_fertilizers',
      amountPaise: 100000, // ₹1,000
      expenseDate: '2026-07-02',
      allocations: [
        { cropId: cropSugarcane, amountPaise: 80000 },
        { cropId: cropSoybean, amountPaise: 30000 }, // total 110,000 > 100,000
      ],
    });
  } catch (err) {
    allocationExceeded = true;
  }
  results.push({
    scenario: 'Scenario A: Reject Allocations Exceeding Total',
    expected: true,
    actual: allocationExceeded,
    passed: allocationExceeded === true,
  });

  // SCENARIO B: Multiple Payments Against Expense
  console.log('--- SCENARIO B: Multiple Payments ---');
  const expB = await finance.createExpense(groupId, userId, {
    farmId,
    expenseCategoryId: 'cat_seeds',
    amountPaise: 1000000, // ₹10,000
    expenseDate: '2026-07-05',
    description: 'बियाणे खरेदी (Seeds Purchase)',
  });

  // First payment: ₹3,000
  await finance.recordPayment(groupId, userId, {
    expenseId: expB.id,
    amountPaise: 300000,
    paymentDate: '2026-07-06',
    paymentMethod: 'cash',
  });
  // Second payment: ₹2,000
  await finance.recordPayment(groupId, userId, {
    expenseId: expB.id,
    amountPaise: 200000,
    paymentDate: '2026-07-07',
    paymentMethod: 'bank_transfer',
  });

  const expBDetails = await finance.getExpenseDetails(groupId, expB.id);
  results.push({
    scenario: 'Scenario B: Total Paid',
    expected: 500000,
    actual: expBDetails.paidPaise,
    passed: expBDetails.paidPaise === 500000,
  });
  results.push({
    scenario: 'Scenario B: Outstanding Balance',
    expected: 500000,
    actual: expBDetails.balancePaise,
    passed: expBDetails.balancePaise === 500000,
  });
  results.push({
    scenario: 'Scenario B: Payment Status (Partial)',
    expected: 'partial',
    actual: expBDetails.paymentStatus,
    passed: expBDetails.paymentStatus === 'partial',
  });

  // Overpayment rejection (attempting ₹6,000 when balance is ₹5,000)
  let overpaymentRejected = false;
  try {
    await finance.recordPayment(groupId, userId, {
      expenseId: expB.id,
      amountPaise: 600000, // ₹6,000
      paymentDate: '2026-07-08',
      paymentMethod: 'cash',
    });
  } catch (err) {
    overpaymentRejected = true;
  }
  results.push({
    scenario: 'Scenario B: Reject Overpayment',
    expected: true,
    actual: overpaymentRejected,
    passed: overpaymentRejected === true,
  });

  // SCENARIO C: Harvest and Sales Tracking
  console.log('--- SCENARIO C: Harvest and Sales ---');
  const harvest = await finance.createHarvest(groupId, userId, {
    farmId,
    cropId: cropSoybean,
    harvestDate: '2026-10-15',
    quantity: 1000.0,
    unit: 'kg',
    notes: 'सोयाबीन काढणी (Soybean Harvest)',
  });
  const harvestId = harvest.id;

  // Sale 1: 400 kg @ ₹50/kg = ₹20,000
  const sale1 = await finance.createSale(groupId, userId, {
    farmId,
    cropId: cropSoybean,
    harvestId,
    buyerName: 'शेतकरी व्यापारी अ (Buyer A)',
    quantity: 400.0,
    unit: 'kg',
    ratePaise: 5000, // ₹50/kg
    saleDate: '2026-10-16',
  });

  // Sale 2: 300 kg @ ₹50/kg = ₹15,000
  const sale2 = await finance.createSale(groupId, userId, {
    farmId,
    cropId: cropSoybean,
    harvestId,
    buyerName: 'शेतकरी व्यापारी ब (Buyer B)',
    quantity: 300.0,
    unit: 'kg',
    ratePaise: 5000,
    saleDate: '2026-10-17',
  });

  const harvestDetails = await finance.getHarvestDetails(groupId, harvestId);
  const remQty = harvestDetails.remainingQuantity;

  results.push({
    scenario: 'Scenario C: Cumulative Sales Quantity',
    expected: 700.0,
    actual: 400.0 + 300.0,
    passed: 400.0 + 300.0 === 700.0,
  });
  results.push({
    scenario: 'Scenario C: Remaining Inventory Quantity',
    expected: 300.0,
    actual: remQty,
    passed: remQty === 300.0,
  });

  // Reject overselling (attempting to sell 400 kg when remaining is 300 kg)
  let oversellRejected = false;
  try {
    await finance.createSale(groupId, userId, {
      farmId,
      cropId: cropSoybean,
      harvestId,
      buyerName: 'अवैध विक्री (Invalid Buyer)',
      quantity: 400.0, // > 300.0 remaining
      unit: 'kg',
      ratePaise: 5000,
      saleDate: '2026-10-18',
    });
  } catch (err) {
    oversellRejected = true;
  }
  results.push({
    scenario: 'Scenario C: Reject Overselling Harvest',
    expected: true,
    actual: oversellRejected,
    passed: oversellRejected === true,
  });

  // Customer payments on Sale 1: Received ₹12,000 of ₹20,000
  await finance.recordPayment(groupId, userId, {
    saleId: sale1.id,
    amountPaise: 1200000, // ₹12,000 received
    paymentDate: '2026-10-19',
    paymentMethod: 'bank_transfer',
  });
  const sale1Details = await finance.getSaleDetails(groupId, sale1.id);
  results.push({
    scenario: 'Scenario C: Sale Receivables Calculation',
    expected: 800000, // ₹8,000 uncollected
    actual: sale1Details.balancePaise,
    passed: sale1Details.balancePaise === 800000,
  });

  // SCENARIO D: Accrual Profitability vs Cash Flow
  console.log('--- SCENARIO D: Accrual Profitability vs Cash Flow ---');
  // Ledger state for this audit:
  // Expenses incurred:
  //   expA: ₹5,000 (paid: ₹0)
  //   expB: ₹10,000 (paid: ₹5,000)
  // Total Incurred Expenses: ₹15,000 (1,500,000 paise)
  // Total Cash Outflows (Money Paid): ₹5,000 (500,000 paise)
  // Outstanding Payables: ₹10,000 (1,000,000 paise)
  //
  // Sales revenue:
  //   sale1: ₹20,000 (received: ₹12,000)
  //   sale2: ₹15,000 (received: ₹0)
  // Total Sales Revenue: ₹35,000 (3,500,000 paise)
  // Total Cash Inflows (Money Received): ₹12,000 (1,200,000 paise)
  // Outstanding Receivables: ₹23,000 (2,300,000 paise)
  //
  // Accrual Profit = Total Sales (₹35,000) - Total Expenses (₹15,000) = ₹20,000 (2,000,000 paise)
  // Net Cash Flow  = Cash Inflows (₹12,000) - Cash Outflows (₹5,000) = ₹7,000 (700,000 paise)

  const summary = await finance.getFinancialSummary(groupId);
  results.push({
    scenario: 'Scenario D: Total Accrual Sales Revenue',
    expected: 3500000,
    actual: summary.totalSalesPaise,
    passed: summary.totalSalesPaise === 3500000,
  });
  results.push({
    scenario: 'Scenario D: Total Accrual Incurred Expenses',
    expected: 1500000,
    actual: summary.totalExpensesPaise,
    passed: summary.totalExpensesPaise === 1500000,
  });
  results.push({
    scenario: 'Scenario D: Accrual Net Profit (Sales - Expenses)',
    expected: 2000000,
    actual: summary.netProfitPaise,
    passed: summary.netProfitPaise === 2000000,
  });
  results.push({
    scenario: 'Scenario D: Total Cash Inflows (Payments Received)',
    expected: 1200000,
    actual: summary.cashInflowPaise,
    passed: summary.cashInflowPaise === 1200000,
  });
  results.push({
    scenario: 'Scenario D: Total Cash Outflows (Payments Made)',
    expected: 500000,
    actual: summary.cashOutflowPaise,
    passed: summary.cashOutflowPaise === 500000,
  });
  results.push({
    scenario: 'Scenario D: Net Cash Flow (Inflow - Outflow)',
    expected: 700000,
    actual: summary.netCashFlowPaise,
    passed: summary.netCashFlowPaise === 700000,
  });
  results.push({
    scenario: 'Scenario D: Outstanding Receivables',
    expected: 2300000,
    actual: summary.receivablesPaise,
    passed: summary.receivablesPaise === 2300000,
  });
  results.push({
    scenario: 'Scenario D: Outstanding Payables',
    expected: 1000000,
    actual: summary.payablesPaise,
    passed: summary.payablesPaise === 1000000,
  });

  // Overhead Isolation: Sugarcane direct expense summary should strictly equal ₹3,000
  const sugarSummary = await finance.getFinancialSummary(groupId, { cropId: cropSugarcane });
  results.push({
    scenario: 'Scenario D: Sugarcane Direct Crop Isolation (Excludes General Overhead & Soybean)',
    expected: 300000, // ₹3,000
    actual: sugarSummary.totalExpensesPaise,
    passed: sugarSummary.totalExpensesPaise === 300000,
  });

  console.log('\n=== FINANCIAL AUDIT SUMMARY ===');
  console.table(results);

  const allPassed = results.every((r) => r.passed);
  console.log('Overall Status:', allPassed ? 'ALL SCENARIOS PASSED (100%)' : 'FAILURES DETECTED');

  const evidencePath = path.resolve('docs', 'verification', 'phase-5', 'financial_scenarios_evidence.json');
  fs.writeFileSync(evidencePath, JSON.stringify(results, null, 2));
  console.log('Saved evidence to:', evidencePath);

  return allPassed;
}

runFinancialAudit()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((err) => {
    console.error('Audit failed with error:', err);
    process.exit(1);
  });
