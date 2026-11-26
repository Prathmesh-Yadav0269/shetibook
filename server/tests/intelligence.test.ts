import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('ShetiBook Phase 4 - Intelligence & Reports Integration Tests', () => {
  const userPhone = '9777711111';
  const outsiderPhone = '9777722222';
  const password = 'IntelPassword123';

  let userCookie = '';
  let outsiderCookie = '';
  let groupId = '';
  let farmId = '';
  let cropId = '';

  it('Setup: Register users and create demo farm with crop & expense', async () => {
    // 1. User
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: userPhone, password, confirmPassword: password });

    const l1 = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: userPhone, password });
    userCookie = (l1.headers['set-cookie'] as unknown as string[])[0];

    // 2. Outsider
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: outsiderPhone, password, confirmPassword: password });

    const l2 = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: outsiderPhone, password });
    outsiderCookie = (l2.headers['set-cookie'] as unknown as string[])[0];

    // 3. Farming Group
    const gRes = await request(app)
      .post('/api/v1/groups')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie)
      .send({ name: 'शिंदे शेती परिवार' });
    groupId = gRes.body.data.id;

    // 4. Farm (5 acres)
    const fRes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie)
      .send({
        farmName: 'वडिलांचे बागायत शेत',
        village: 'सुपे',
        areaValue: 5,
        areaUnit: 'acre',
      });
    farmId = fRes.body.data.id;

    // 5. Plot (3 acres)
    const pRes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie)
      .send({
        plotName: 'तुकडा १ (विहीर शेजारी)',
        areaValue: 3,
        areaUnit: 'acre',
        cultivationMode: 'separate',
      });
    const plotId = pRes.body.data.id;

    // 6. Crop (Sugarcane)
    const cRes = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie)
      .send({
        farmId,
        plotId,
        cropTypeId: 'crop_sugarcane',
        cropSeasonId: 'season_perennial',
        cropNameCustom: 'को ८६०३२ ऊस',
        sowingDate: '2026-11-01',
      });
    cropId = cRes.body.data.id;

    // Transition crop to active
    await request(app)
      .patch(`/api/v1/groups/${groupId}/crops/${cropId}/status`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie)
      .send({ status: 'active' });

    // 7. Expense (₹4,000 / 400000 paise)
    await request(app)
      .post(`/api/v1/groups/${groupId}/expenses`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie)
      .send({
        farmId,
        expenseCategoryId: 'cat_fertilizers',
        amountPaise: 400000,
        expenseDate: '2026-11-10',
        description: 'सेंद्रिय खते',
        allocations: [{ cropId, amountPaise: 300000 }],
      });

    // 8. Sale (₹12,000 / 1200000 paise)
    await request(app)
      .post(`/api/v1/groups/${groupId}/sales`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie)
      .send({
        farmId,
        cropId,
        saleDate: '2026-11-15',
        quantity: 5,
        unit: 'quintal',
        ratePaise: 240000,
        totalAmountPaise: 1200000,
        buyerName: 'दत्ता अडत दुकान',
      });
  });

  it('1. GET /dashboard returns aggregated farm, crop, activity and financial KPIs', async () => {
    const res = await request(app)
      .get(`/api/v1/groups/${groupId}/dashboard`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Farm metrics
    expect(data.farms.total).toBe(1);
    expect(data.farms.list[0].farmName).toBe('वडिलांचे बागायत शेत');
    expect(data.farms.totalAreaBreakdown.acres).toBe(5);

    // Crops
    expect(data.crops.activeCount).toBe(1);
    expect(data.crops.list.length).toBe(1);
    expect(data.crops.list[0].cropNameMr).toBe('ऊस');

    // Financial
    expect(data.financial.totalSalesPaise).toBe(1200000);
    expect(data.financial.totalExpensesPaise).toBe(400000);
    expect(data.financial.netProfitPaise).toBe(800000);
  });

  it('2. GET /reports provides farm-wise and crop-wise reporting', async () => {
    // Farm report
    const farmRep = await request(app)
      .get(`/api/v1/groups/${groupId}/reports?type=farms`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie);

    expect(farmRep.status).toBe(200);
    expect(farmRep.body.data.length).toBe(1);
    expect(farmRep.body.data[0].farmName).toBe('वडिलांचे बागायत शेत');
    expect(farmRep.body.data[0].totalSalesPaise).toBe(1200000);
    expect(farmRep.body.data[0].totalExpensePaise).toBe(400000);

    // Crop report
    const cropRep = await request(app)
      .get(`/api/v1/groups/${groupId}/reports?type=crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie);

    expect(cropRep.status).toBe(200);
    expect(cropRep.body.data.length).toBe(1);
    expect(cropRep.body.data[0].cropNameMr).toBe('ऊस');
    expect(cropRep.body.data[0].allocatedExpensePaise).toBe(300000);
    expect(cropRep.body.data[0].salesRevenuePaise).toBe(1200000);
    expect(cropRep.body.data[0].netProfitPaise).toBe(900000);
  });

  it('3. GET /reports/export produces UTF-8 BOM CSV with formula injection sanitization', async () => {
    const csvRes = await request(app)
      .get(`/api/v1/groups/${groupId}/reports/export?dataset=expenses`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', userCookie);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.headers['content-disposition']).toContain('attachment');

    const text = csvRes.text;
    // Check UTF-8 Byte Order Mark
    expect(text.charCodeAt(0)).toBe(0xfeff);
    // Check Marathi content
    expect(text).toContain('खत');
    expect(text).toContain('वडिलांचे बागायत शेत');
  });

  it('4. Rejects outsider from accessing dashboard and reports (Group Isolation)', async () => {
    const dRes = await request(app)
      .get(`/api/v1/groups/${groupId}/dashboard`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', outsiderCookie);
    expect(dRes.status).toBe(403);

    const rRes = await request(app)
      .get(`/api/v1/groups/${groupId}/reports`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', outsiderCookie);
    expect(rRes.status).toBe(403);
  });
});
