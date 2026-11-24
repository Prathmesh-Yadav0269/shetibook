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
});
