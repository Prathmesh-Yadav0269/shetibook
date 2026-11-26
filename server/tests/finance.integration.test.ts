import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('ShetiBook Phase 3 - Financial & Business Management Integration Tests', () => {
  const ownerPhone = '9888811111';
  const outsiderPhone = '9888822222';
  const password = 'FinancePassword123';

  let ownerCookie = '';
  let outsiderCookie = '';
  let groupId = '';
  let outsiderGroupId = '';
  let farmId = '';
  let plotId = '';
  let cropId = '';
  let customCategoryId = '';
  let expenseId = '';
  let harvestId = '';
  let saleId = '';

  it('Step 1: Register and login Owner and Outsider', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: ownerPhone, password, confirmPassword: password });

    const l1 = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: ownerPhone, password });

    ownerCookie = (l1.headers['set-cookie'] as unknown as string[])[0];

    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: outsiderPhone, password, confirmPassword: password });

    const l2 = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: outsiderPhone, password });

    outsiderCookie = (l2.headers['set-cookie'] as unknown as string[])[0];

    expect(ownerCookie).toBeDefined();
    expect(outsiderCookie).toBeDefined();
  });

  it('Step 2: Setup Farming Groups, Farm, Plot and Crop', async () => {
    // Owner group
    const g1 = await request(app)
      .post('/api/v1/groups')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ name: 'शिंदे शेती परिवार (Shinde Farm)' });
    expect(g1.status).toBe(201);
    groupId = g1.body.data.id;

    // Outsider group
    const g2 = await request(app)
      .post('/api/v1/groups')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', outsiderCookie)
      .send({ name: 'परका शेती गट (Outsider Farm)' });
    expect(g2.status).toBe(201);
    outsiderGroupId = g2.body.data.id;

    // Create Farm
    const farmRes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmName: 'शिंदे मळा (Shinde Farm)',
        village: 'जुन्नर',
        taluka: 'जुन्नर',
        district: 'पुणे',
        areaValue: 5,
        areaUnit: 'acre',
      });
    expect(farmRes.status).toBe(201);
    farmId = farmRes.body.data.id;

    // Create Plot
    const plotRes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        plotName: 'प्लॉट १ (गहू शेत)',
        areaValue: 3,
        areaUnit: 'acre',
        cultivationMode: 'separate',
      });
    expect(plotRes.status).toBe(201);
    plotId = plotRes.body.data.id;

    // Create Crop
    const cropRes = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        plotId,
        cropTypeId: 'crop_wheat',
        cropSeasonId: 'season_rabi',
        cropNameCustom: 'शरबती गहू (Sharbati Wheat)',
        sowingDate: '2026-11-01',
      });
    expect(cropRes.status).toBe(201);
    cropId = cropRes.body.data.id;
  });

  it('Step 3: List pre-seeded expense categories and create custom category', async () => {
    const listRes = await request(app)
      .get(`/api/v1/groups/${groupId}/expenses/categories`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(10);
    expect(listRes.body.data.some((c: { id: string }) => c.id === 'cat_seeds')).toBe(true);

    // Create custom category
    const catRes = await request(app)
      .post(`/api/v1/groups/${groupId}/expenses/categories`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        nameMr: 'ठिबक सिंचन दुरुस्ती',
        nameEn: 'Drip Irrigation Maintenance',
      });

    expect(catRes.status).toBe(201);
    expect(catRes.body.data.nameMr).toBe('ठिबक सिंचन दुरुस्ती');
    customCategoryId = catRes.body.data.id;
  });

  it('Step 4: Record farm expense with optional crop allocation', async () => {
    // Expense: ₹5,000 (500000 paise), ₹3,000 allocated to wheat crop, ₹2,000 unallocated general farm expense
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/expenses`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        expenseCategoryId: 'cat_fertilizers',
        amountPaise: 500000,
        expenseDate: '2026-11-10',
        description: 'युरिया व डीएपी खते खरेदी',
        allocations: [
          {
            cropId,
            amountPaise: 300000,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.amountPaise).toBe(500000);
    expect(res.body.data.allocatedPaise).toBe(300000);
    expect(res.body.data.unallocatedPaise).toBe(200000);
    expect(res.body.data.paidPaise).toBe(0);
    expect(res.body.data.balancePaise).toBe(500000);
    expect(res.body.data.paymentStatus).toBe('unpaid');
    expect(res.body.data.allocations.length).toBe(1);

    expenseId = res.body.data.id;
  });

  it('Step 5: Record payments against expense and verify derived payment status', async () => {
    // 1. Partial payment: ₹2,000 (200000 paise) via UPI
    const p1 = await request(app)
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        expenseId,
        amountPaise: 200000,
        paymentDate: '2026-11-10',
        paymentMethod: 'upi',
        referenceNumber: 'UPI/123456789',
        notes: 'कृषी केंद्र ऑनलाईन पेमेंट',
      });

    expect(p1.status).toBe(201);

    // Verify expense status is 'partial'
    const exp1 = await request(app)
      .get(`/api/v1/groups/${groupId}/expenses/${expenseId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(exp1.body.data.paidPaise).toBe(200000);
    expect(exp1.body.data.balancePaise).toBe(300000);
    expect(exp1.body.data.paymentStatus).toBe('partial');
    expect(exp1.body.data.payments.length).toBe(1);

    // 2. Second payment for remaining ₹3,000 (300000 paise) via Cash
    const p2 = await request(app)
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        expenseId,
        amountPaise: 300000,
        paymentDate: '2026-11-12',
        paymentMethod: 'cash',
        notes: 'रोख चुकता',
      });

    expect(p2.status).toBe(201);

    // Verify expense status is now 'paid'
    const exp2 = await request(app)
      .get(`/api/v1/groups/${groupId}/expenses/${expenseId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(exp2.body.data.paidPaise).toBe(500000);
    expect(exp2.body.data.balancePaise).toBe(0);
    expect(exp2.body.data.paymentStatus).toBe('paid');
    expect(exp2.body.data.payments.length).toBe(2);

    // 3. Reject overpayment
    const overpay = await request(app)
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        expenseId,
        amountPaise: 50000,
        paymentDate: '2026-11-13',
        paymentMethod: 'cash',
      });

    expect(overpay.status).toBe(400);
    expect(overpay.body.error.message).toContain('पेमेंट शिल्लक रक्कमेपेक्षा');
  });

  it('Step 6: Record Harvest and verify remaining quantity tracking', async () => {
    // Harvest 10 quintals (1000 kg) of Sharbati Wheat
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/harvests`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        cropId,
        harvestDate: '2026-11-20',
        quantity: 10,
        unit: 'quintal',
        notes: 'उत्कृष्ट प्रतीचा गहू काढणी पूर्ण',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.quantity).toBe(10);
    expect(res.body.data.unit).toBe('quintal');
    expect(res.body.data.soldQuantity).toBe(0);
    expect(res.body.data.remainingQuantity).toBe(10);

    harvestId = res.body.data.id;
  });

  it('Step 7: Record Sale linked to harvest and reject overselling', async () => {
    // 1. Sell 6 quintals at ₹2,500/quintal (rate: 250000 paise, total: 1500000 paise)
    const saleRes = await request(app)
      .post(`/api/v1/groups/${groupId}/sales`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        cropId,
        harvestId,
        saleDate: '2026-11-21',
        quantity: 6,
        unit: 'quintal',
        ratePaise: 250000,
        buyerName: 'रमेश व्यापारी (जुन्नर मार्केट)',
        notes: '६ क्विंटल गहू विक्री',
      });

    expect(saleRes.status).toBe(201);
    expect(saleRes.body.data.totalAmountPaise).toBe(1500000);
    expect(saleRes.body.data.paymentStatus).toBe('unpaid');
    saleId = saleRes.body.data.id;

    // Check harvest remaining quantity is now 4 quintals
    const hRes = await request(app)
      .get(`/api/v1/groups/${groupId}/harvests/${harvestId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(hRes.body.data.soldQuantity).toBe(6);
    expect(hRes.body.data.remainingQuantity).toBe(4);

    // 2. Attempt overselling: try to sell 5 quintals (> 4 quintals remaining)
    const overRes = await request(app)
      .post(`/api/v1/groups/${groupId}/sales`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        cropId,
        harvestId,
        saleDate: '2026-11-22',
        quantity: 5,
        unit: 'quintal',
        ratePaise: 250000,
        buyerName: 'सुरेश व्यापारी',
      });

    expect(overRes.status).toBe(400);
    expect(overRes.body.error.message).toContain('काढणीच्या शिल्लक प्रमाणापेक्षा जास्त विक्री करता येणार नाही');

    // 3. Record direct sale without harvest: 2 quintals at ₹3,000/quintal (total 600000 paise)
    const directSale = await request(app)
      .post(`/api/v1/groups/${groupId}/sales`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        cropId,
        saleDate: '2026-11-22',
        quantity: 2,
        unit: 'quintal',
        ratePaise: 300000,
        buyerName: 'स्थानिक ग्राहक',
      });

    expect(directSale.status).toBe(201);
    expect(directSale.body.data.totalAmountPaise).toBe(600000);
    expect(directSale.body.data.harvestId).toBeNull();
  });

  it('Step 8: Record payment for sale and verify financial summary metrics', async () => {
    // Receive payment on first sale: ₹10,000 (1000000 paise) via Bank Transfer
    const pSale = await request(app)
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        saleId,
        amountPaise: 1000000,
        paymentDate: '2026-11-22',
        paymentMethod: 'bank_transfer',
        referenceNumber: 'NEFT/987654321',
        notes: 'व्यापाऱ्याकडून बँक खात्यात जमा',
      });

    expect(pSale.status).toBe(201);

    // Fetch Financial Summary
    const sumRes = await request(app)
      .get(`/api/v1/groups/${groupId}/finance/summary`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(sumRes.status).toBe(200);
    const summary = sumRes.body.data;

    // Total Sales: ₹15,000 + ₹6,000 = ₹21,000 (2,100,000 paise)
    expect(summary.totalSalesPaise).toBe(2100000);
    // Total Expenses: ₹5,000 (500,000 paise)
    expect(summary.totalExpensesPaise).toBe(500000);
    // Accrual Net Profit: ₹21,000 - ₹5,000 = ₹16,000 (1,600,000 paise)
    expect(summary.netProfitPaise).toBe(1600000);
    // Realized Cash Inflow: ₹10,000 (1,000,000 paise)
    expect(summary.cashInflowPaise).toBe(1000000);
    // Realized Cash Outflow: ₹5,000 (500,000 paise)
    expect(summary.cashOutflowPaise).toBe(500000);
    // Net Cash Flow: ₹10,000 - ₹5,000 = ₹5,000 (500,000 paise)
    expect(summary.netCashFlowPaise).toBe(500000);
    // Outstanding Receivables: ₹21,000 - ₹10,000 = ₹11,000 (1,100,000 paise)
    expect(summary.receivablesPaise).toBe(1100000);
    // Outstanding Payables: 0
    expect(summary.payablesPaise).toBe(0);
    // Category Breakdown
    expect(summary.categoryBreakdown.length).toBeGreaterThan(0);
  });

  it('Step 9: Enforce multi-tenant group isolation', async () => {
    // Outsider cannot view owner group expenses
    const expOutsider = await request(app)
      .get(`/api/v1/groups/${groupId}/expenses`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', outsiderCookie);
    expect(expOutsider.status).toBe(403);

    // Outsider cannot access owner expense details
    const expDetailOutsider = await request(app)
      .get(`/api/v1/groups/${groupId}/expenses/${expenseId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', outsiderCookie);
    expect(expDetailOutsider.status).toBe(403);

    // Outsider cannot view owner harvests
    const harvestOutsider = await request(app)
      .get(`/api/v1/groups/${groupId}/harvests`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', outsiderCookie);
    expect(harvestOutsider.status).toBe(403);

    // Outsider cannot view owner sales
    const salesOutsider = await request(app)
      .get(`/api/v1/groups/${groupId}/sales`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', outsiderCookie);
    expect(salesOutsider.status).toBe(403);

    // Outsider cannot access financial summary of owner group
    const summaryOutsider = await request(app)
      .get(`/api/v1/groups/${groupId}/finance/summary`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', outsiderCookie);
    expect(summaryOutsider.status).toBe(403);
  });

  it('Step 10: Concurrency Test: Exactly one concurrent payment succeeds against remaining balance', async () => {
    // Create dedicated expense of ₹1,000 (100,000 paise)
    const newExp = await request(app)
      .post(`/api/v1/groups/${groupId}/expenses`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        expenseCategoryId: 'cat_fuel',
        amountPaise: 100000,
        expenseDate: '2026-11-23',
        description: 'डिझेल खरेदी (शर्यत चाचणी खर्च)',
      });
    expect(newExp.status).toBe(201);
    const testExpId = newExp.body.data.id;

    // Fire two simultaneous payments each attempting to pay the entire ₹1,000 balance
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/v1/groups/${groupId}/payments`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', ownerCookie)
        .send({
          expenseId: testExpId,
          amountPaise: 100000,
          paymentDate: '2026-11-23',
          paymentMethod: 'cash',
          notes: 'समवर्ती पेमेंट १',
        }),
      request(app)
        .post(`/api/v1/groups/${groupId}/payments`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', ownerCookie)
        .send({
          expenseId: testExpId,
          amountPaise: 100000,
          paymentDate: '2026-11-23',
          paymentMethod: 'upi',
          notes: 'समवर्ती पेमेंट २',
        }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one must succeed (201) and one must be rejected (400)
    expect(statuses).toEqual([201, 400]);

    const failedRes = res1.status === 400 ? res1 : res2;
    expect(failedRes.body.error.message).toContain('पेमेंट शिल्लक रक्कमेपेक्षा');

    // Verify expense has exactly 1 payment and balance is 0
    const expDetail = await request(app)
      .get(`/api/v1/groups/${groupId}/expenses/${testExpId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(expDetail.body.data.paidPaise).toBe(100000);
    expect(expDetail.body.data.balancePaise).toBe(0);
    expect(expDetail.body.data.paymentStatus).toBe('paid');
    expect(expDetail.body.data.payments.length).toBe(1);
  });

  it('Step 11: Concurrency Test: Exactly one concurrent sale succeeds without overselling harvest', async () => {
    // Create dedicated harvest of 2 quintals
    const newHarv = await request(app)
      .post(`/api/v1/groups/${groupId}/harvests`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        cropId,
        harvestDate: '2026-11-23',
        quantity: 2,
        unit: 'quintal',
        notes: 'समवर्ती विक्री चाचणीसाठी काढणी',
      });
    expect(newHarv.status).toBe(201);
    const testHarvId = newHarv.body.data.id;

    // Fire two simultaneous sales each requesting all 2 quintals
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/v1/groups/${groupId}/sales`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', ownerCookie)
        .send({
          farmId,
          cropId,
          harvestId: testHarvId,
          saleDate: '2026-11-23',
          quantity: 2,
          unit: 'quintal',
          ratePaise: 250000,
          buyerName: 'समवर्ती खरेदीदार १',
        }),
      request(app)
        .post(`/api/v1/groups/${groupId}/sales`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', ownerCookie)
        .send({
          farmId,
          cropId,
          harvestId: testHarvId,
          saleDate: '2026-11-23',
          quantity: 2,
          unit: 'quintal',
          ratePaise: 250000,
          buyerName: 'समवर्ती खरेदीदार २',
        }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one must succeed (201) and one must be rejected (400)
    expect(statuses).toEqual([201, 400]);

    const failedRes = res1.status === 400 ? res1 : res2;
    expect(failedRes.body.error.message).toContain('काढणीच्या शिल्लक प्रमाणापेक्षा जास्त विक्री करता येणार नाही');

    // Verify harvest remaining quantity is strictly 0 and sold is 2
    const harvDetail = await request(app)
      .get(`/api/v1/groups/${groupId}/harvests/${testHarvId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(harvDetail.body.data.soldQuantity).toBe(2);
    expect(harvDetail.body.data.remainingQuantity).toBe(0);
  });

  it('Step 12: Controlled Multi-Crop Financial Verification Scenario (Task D Specification)', async () => {
    // 1. Setup Farm A and 2 Crops (Sugarcane & Soybean)
    const farmARes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmName: 'Farm A (शेत अ)',
        village: 'सासवड',
        areaValue: 10,
        areaUnit: 'acre',
      });
    expect(farmARes.status).toBe(201);
    const farmAId = farmARes.body.data.id;

    const plotARes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmAId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        plotName: 'प्लॉट १ (मिश्र पीक)',
        areaValue: 8,
        areaUnit: 'acre',
        cultivationMode: 'intercropping',
      });
    expect(plotARes.status).toBe(201);
    const plotAId = plotARes.body.data.id;

    // Crop 1: Sugarcane
    const sugarRes = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId: farmAId,
        plotId: plotAId,
        cropTypeId: 'crop_sugarcane',
        cropSeasonId: 'season_perennial',
        cropNameCustom: 'ऊस (Sugarcane)',
        sowingDate: '2026-06-01',
      });
    expect(sugarRes.status).toBe(201);
    const sugarcaneId = sugarRes.body.data.id;

    // Crop 2: Soybean
    const soyRes = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId: farmAId,
        plotId: plotAId,
        cropTypeId: 'crop_soybean',
        cropSeasonId: 'season_kharif',
        cropNameCustom: 'सोयाबीन (Soybean)',
        sowingDate: '2026-06-15',
      });
    expect(soyRes.status).toBe(201);
    const soybeanId = soyRes.body.data.id;

    // 2. Expenses with controlled allocations:
    // Expense 1: Fertilizer ₹4,000 (Sugarcane ₹3,000, Soybean ₹500, General overhead ₹500)
    const exp1Res = await request(app)
      .post(`/api/v1/groups/${groupId}/expenses`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId: farmAId,
        expenseCategoryId: 'cat_fertilizers',
        amountPaise: 400000,
        expenseDate: '2026-07-01',
        description: 'रासायनिक व सेंद्रिय खते',
        allocations: [
          { cropId: sugarcaneId, amountPaise: 300000 },
          { cropId: soybeanId, amountPaise: 50000 },
        ],
      });
    expect(exp1Res.status).toBe(201);
    const exp1Id = exp1Res.body.data.id;

    // Expense 2: Labour ₹3,000 (Sugarcane ₹1,000, Soybean ₹1,000, General overhead ₹1,000)
    const exp2Res = await request(app)
      .post(`/api/v1/groups/${groupId}/expenses`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId: farmAId,
        expenseCategoryId: 'cat_labour',
        amountPaise: 300000,
        expenseDate: '2026-07-15',
        description: 'मजुरी खर्च',
        allocations: [
          { cropId: sugarcaneId, amountPaise: 100000 },
          { cropId: soybeanId, amountPaise: 100000 },
        ],
      });
    expect(exp2Res.status).toBe(201);
    const exp2Id = exp2Res.body.data.id;

    // Expense 3: Machinery ₹2,000 (General farm overhead ₹2,000, unallocated to crops)
    const exp3Res = await request(app)
      .post(`/api/v1/groups/${groupId}/expenses`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId: farmAId,
        expenseCategoryId: 'cat_machinery',
        amountPaise: 200000,
        expenseDate: '2026-08-01',
        description: 'ट्रॅक्टर मशागत (शेत ओव्हरहेड)',
        allocations: [],
      });
    expect(exp3Res.status).toBe(201);
    const exp3Id = exp3Res.body.data.id;

    // 3. Invoiced Sales:
    // Sale 1: Sugarcane ₹12,000
    const sale1Res = await request(app)
      .post(`/api/v1/groups/${groupId}/sales`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId: farmAId,
        cropId: sugarcaneId,
        saleDate: '2026-10-01',
        quantity: 10,
        unit: 'quintal',
        ratePaise: 120000,
        totalAmountPaise: 1200000,
        buyerName: 'साखर कारखाना',
      });
    expect(sale1Res.status).toBe(201);
    const sale1Id = sale1Res.body.data.id;

    // Sale 2: Soybean ₹6,000
    const sale2Res = await request(app)
      .post(`/api/v1/groups/${groupId}/sales`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId: farmAId,
        cropId: soybeanId,
        saleDate: '2026-10-15',
        quantity: 5,
        unit: 'quintal',
        ratePaise: 120000,
        totalAmountPaise: 600000,
        buyerName: 'कृषी उत्पन्न बाजार समिती',
      });
    expect(sale2Res.status).toBe(201);
    const sale2Id = sale2Res.body.data.id;

    // 4. Payments:
    // Sugarcane sale payment received: ₹5,000
    await request(app)
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        saleId: sale1Id,
        paymentType: 'income',
        paymentMethod: 'bank_transfer',
        amountPaise: 500000,
        paymentDate: '2026-10-05',
      });

    // Soybean sale payment received: ₹2,000
    await request(app)
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        saleId: sale2Id,
        paymentType: 'income',
        paymentMethod: 'cash',
        amountPaise: 200000,
        paymentDate: '2026-10-20',
      });

    // Fertilizer expense payment: ₹2,000
    await request(app)
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        expenseId: exp1Id,
        paymentType: 'expense',
        paymentMethod: 'bank_transfer',
        amountPaise: 200000,
        paymentDate: '2026-07-05',
      });

    // Labour expense payment: ₹1,000
    await request(app)
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        expenseId: exp2Id,
        paymentType: 'expense',
        paymentMethod: 'cash',
        amountPaise: 100000,
        paymentDate: '2026-07-20',
      });

    // Machinery expense payment: ₹500
    await request(app)
      .post(`/api/v1/groups/${groupId}/payments`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        expenseId: exp3Id,
        paymentType: 'expense',
        paymentMethod: 'cash',
        amountPaise: 50000,
        paymentDate: '2026-08-05',
      });

    // 5. Independently Reconcile Farm A Calculations:
    const farmSummaryRes = await request(app)
      .get(`/api/v1/groups/${groupId}/finance/summary?farmId=${farmAId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(farmSummaryRes.status).toBe(200);
    const farmSummary = farmSummaryRes.body.data;

    // Expected Farm Totals:
    // Accrual Revenue: ₹18,000 (1,800,000 paise)
    expect(farmSummary.totalSalesPaise).toBe(1800000);
    // Accrual Expenses: ₹9,000 (900,000 paise)
    expect(farmSummary.totalExpensesPaise).toBe(900000);
    // Accrual Net Profit: ₹9,000 (900,000 paise)
    expect(farmSummary.netProfitPaise).toBe(900000);

    // Cash Inflow: ₹7,000 (700,000 paise)
    expect(farmSummary.cashInflowPaise).toBe(700000);
    // Cash Outflow: ₹3,500 (350,000 paise)
    expect(farmSummary.cashOutflowPaise).toBe(350000);
    // Net Cash Flow: ₹3,500 (350,000 paise)
    expect(farmSummary.netCashFlowPaise).toBe(350000);

    // Receivables: ₹11,000 (1,100,000 paise)
    expect(farmSummary.receivablesPaise).toBe(1100000);
    // Payables: ₹5,500 (550,000 paise)
    expect(farmSummary.payablesPaise).toBe(550000);

    // Mathematical reconciliation check: Profit - CashFlow === Receivables - Payables
    expect(farmSummary.netProfitPaise - farmSummary.netCashFlowPaise).toBe(
      farmSummary.receivablesPaise - farmSummary.payablesPaise
    );

    // 6. Crop-Level Direct Profitability Reports:
    const cropReportsRes = await request(app)
      .get(`/api/v1/groups/${groupId}/reports?type=crops&farmId=${farmAId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(cropReportsRes.status).toBe(200);
    const crops = cropReportsRes.body.data;

    const sugarReport = crops.find((c: any) => c.id === sugarcaneId);
    expect(sugarReport).toBeDefined();
    // Sugarcane direct allocated expense: ₹3,000 + ₹1,000 = ₹4,000 (400,000 paise)
    expect(sugarReport.allocatedExpensePaise).toBe(400000);
    // Sugarcane sales revenue: ₹12,000 (1,200,000 paise)
    expect(sugarReport.salesRevenuePaise).toBe(1200000);
    // Sugarcane direct profit: ₹12,000 - ₹4,000 = ₹8,000 (800,000 paise)
    expect(sugarReport.netProfitPaise).toBe(800000);

    const soyReport = crops.find((c: any) => c.id === soybeanId);
    expect(soyReport).toBeDefined();
    // Soybean direct allocated expense: ₹500 + ₹1,000 = ₹1,500 (150,000 paise)
    expect(soyReport.allocatedExpensePaise).toBe(150000);
    // Soybean sales revenue: ₹6,000 (600,000 paise)
    expect(soyReport.salesRevenuePaise).toBe(600000);
    // Soybean direct profit: ₹6,000 - ₹1,500 = ₹4,500 (450,000 paise)
    expect(soyReport.netProfitPaise).toBe(450000);

    // 7. General Farm Overhead Verification:
    // General overhead = Total Farm Expenses (₹9,000) - Sum of Direct Crop Allocations (₹4,000 + ₹1,500 = ₹5,500) = ₹3,500
    const totalCropAllocated = sugarReport.allocatedExpensePaise + soyReport.allocatedExpensePaise;
    const generalOverheadPaise = farmSummary.totalExpensesPaise - totalCropAllocated;
    expect(generalOverheadPaise).toBe(350000); // Exactly ₹3,500
  });
});
