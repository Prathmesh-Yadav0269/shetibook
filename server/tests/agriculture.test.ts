import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getDatabaseClient } from '../src/database/client.js';

describe('ShetiBook Phase 2 - Farm & Agricultural Management Tests', () => {
  const memberPhone = '9888877771';
  const outsiderPhone = '9888877772';
  const password = 'FarmPassword123';

  let memberCookie = '';
  let outsiderCookie = '';
  let groupId = '';
  let farmId = '';
  let plot1Id = ''; // separate plot
  let plot2Id = ''; // intercropping plot
  let crop1Id = '';
  let crop2Id = '';
  let activityId = '';

  it('Setup: Register member and outsider, create family group', async () => {
    // 1. Register Member
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: memberPhone, password, confirmPassword: password });

    const l1 = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: memberPhone, password });
    memberCookie = (l1.headers['set-cookie'] as unknown as string[])[0];

    // 2. Register Outsider
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: outsiderPhone, password, confirmPassword: password });

    const l2 = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: outsiderPhone, password });
    outsiderCookie = (l2.headers['set-cookie'] as unknown as string[])[0];

    // 3. Create Group
    const groupRes = await request(app)
      .post('/api/v1/groups')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ name: 'शिंदे शेती परिवार (Shinde Farm Family)' });

    expect(groupRes.status).toBe(201);
    groupId = groupRes.body.data.id;
  });

  // ==========================================
  // 1. FARMS
  // ==========================================

  it('1. Successfully creates a farm with area in acres and calculates breakdown', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/farms`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        farmName: 'वडिलांची शेतजमीन (Main Farm)',
        village: 'बारामती (Baramati)',
        taluka: 'बारामती',
        district: 'पुणे',
        areaValue: 5,
        areaUnit: 'acre',
        surveyNumber: '124/2A',
        notes: 'बागायती काळी जमीन',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.farmName).toBe('वडिलांची शेतजमीन (Main Farm)');
    expect(res.body.data.village).toBe('बारामती (Baramati)');
    expect(res.body.data.areaValue).toBe(5);
    expect(res.body.data.areaUnit).toBe('acre');
    expect(res.body.data.breakdown.guntha).toBe(200);
    expect(res.body.data.breakdown.acre).toBe(5);
    farmId = res.body.data.id;
  });

  it('2. Rejects farm creation with negative or zero area', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/farms`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        farmName: 'चुकीचे शेत',
        village: 'गाव',
        areaValue: -2,
        areaUnit: 'acre',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('3. Lists farms with correct plot count and unallocated area', async () => {
    const res = await request(app)
      .get(`/api/v1/groups/${groupId}/farms`)
      .set('Cookie', memberCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(farmId);
    expect(res.body.data[0].plotCount).toBe(0);
    expect(res.body.data[0].unallocatedInUnit).toBe(5);
  });

  // ==========================================
  // 2. PLOTS & AREA VALIDATION
  // ==========================================

  it('4. Creates Plot 1 in separate mode (2 acres)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        plotName: 'तुकडा अ (Plot A)',
        areaValue: 2,
        areaUnit: 'acre',
        cultivationMode: 'separate',
        notes: 'विहिरीजवळचा तुकडा',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cultivationMode).toBe('separate');
    expect(res.body.data.areaValue).toBe(2);
    plot1Id = res.body.data.id;
  });

  it('5. Creates Plot 2 in intercropping mode (2 acres)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        plotName: 'तुकडा ब (Plot B)',
        areaValue: 2,
        areaUnit: 'acre',
        cultivationMode: 'intercropping',
        notes: 'आंतरपीक प्लॉट',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.cultivationMode).toBe('intercropping');
    plot2Id = res.body.data.id;
  });

  it('6. Rejects plot creation when plot area exceeds available farm area', async () => {
    // Farm is 5 acres. Plot 1 (2 acres) + Plot 2 (2 acres) = 4 acres allocated.
    // Remaining unallocated is 1 acre. Trying to create 2 acres plot must fail.
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        plotName: 'तुकडा क (Plot C)',
        areaValue: 2,
        areaUnit: 'acre',
        cultivationMode: 'separate',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLOT_AREA_EXCEEDS_FARM');
  });

  it('7. Rejects duplicate active plot name on the same farm', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        plotName: 'तुकडा अ (Plot A)', // Duplicate of Plot 1
        areaValue: 0.5,
        areaUnit: 'acre',
        cultivationMode: 'separate',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_PLOT_NAME');
  });

  // ==========================================
  // 3. CROPS & INTERCROPPING RULES
  // ==========================================

  it('8. Retrieves crop metadata (Maharashtra crop types and seasons)', async () => {
    const res = await request(app)
      .get(`/api/v1/groups/${groupId}/crops/metadata`)
      .set('Cookie', memberCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.cropTypes.length).toBeGreaterThanOrEqual(11);
    expect(res.body.data.cropSeasons.length).toBe(4);
    expect(res.body.data.cropTypes.some((c: { nameMr: string }) => c.nameMr === 'ऊस')).toBe(true);
    expect(res.body.data.cropTypes.some((c: { nameMr: string }) => c.nameMr === 'सोयाबीन')).toBe(true);
  });

  it('9. Registers a crop on Plot 1 (separate mode)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        farmId,
        plotId: plot1Id,
        cropTypeId: 'crop_wheat',
        cropSeasonId: 'season_rabi',
        cropNameCustom: 'शरबती गहू',
        sowingDate: '2026-11-01',
        expectedHarvestDate: '2027-03-15',
        notes: 'उच्च प्रतीचे बियाणे',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cropNameMr).toBe('गहू');
    expect(res.body.data.status).toBe('planned');
    crop1Id = res.body.data.id;
  });

  it('10. Rejects registering second active crop on separate mode plot', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        farmId,
        plotId: plot1Id, // Same separate plot
        cropTypeId: 'crop_chickpea',
        cropSeasonId: 'season_rabi',
        sowingDate: '2026-11-05',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SEPARATE_MODE_SINGLE_CROP');
  });

  it('11. Allows multiple crops on Plot 2 (intercropping mode)', async () => {
    // 1. First Crop: Sugarcane
    const res1 = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        farmId,
        plotId: plot2Id,
        cropTypeId: 'crop_sugarcane',
        cropSeasonId: 'season_perennial',
        cropNameCustom: 'को ८६०३२ ऊस',
        sowingDate: '2026-10-15',
        expectedHarvestDate: '2027-10-15',
      });

    expect(res1.status).toBe(201);
    crop2Id = res1.body.data.id;

    // 2. Second Crop: Soybean (Intercrop in same plot)
    const res2 = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        farmId,
        plotId: plot2Id,
        cropTypeId: 'crop_soybean',
        cropSeasonId: 'season_kharif',
        cropNameCustom: 'सोयाबीन आंतरपीक',
        sowingDate: '2026-10-20',
        expectedHarvestDate: '2027-01-20',
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data.plotName).toBe('तुकडा ब (Plot B)');
  });

  it('12. Rejects switching intercropping plot to separate mode while multiple active crops exist', async () => {
    const res = await request(app)
      .patch(`/api/v1/groups/${groupId}/farms/${farmId}/plots/${plot2Id}/mode`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ cultivationMode: 'separate' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MULTIPLE_ACTIVE_CROPS');
  });

  it('13. Validates crop harvest date cannot be earlier than sowing date', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        farmId,
        plotId: plot2Id,
        cropTypeId: 'crop_onion',
        cropSeasonId: 'season_rabi',
        sowingDate: '2026-11-20',
        expectedHarvestDate: '2026-10-10', // Invalid: before sowing
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('14. Transitions crop status to active and harvested', async () => {
    // 1. Transition to active
    const r1 = await request(app)
      .patch(`/api/v1/groups/${groupId}/crops/${crop1Id}/status`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ status: 'active' });

    expect(r1.status).toBe(200);
    expect(r1.body.data.status).toBe('active');

    // 2. Transition to harvested
    const r2 = await request(app)
      .patch(`/api/v1/groups/${groupId}/crops/${crop1Id}/status`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ status: 'harvested', actualHarvestDate: '2027-03-20' });

    expect(r2.status).toBe(200);
    expect(r2.body.data.status).toBe('harvested');
    expect(r2.body.data.actualHarvestDate).toBe('2027-03-20');
  });

  // ==========================================
  // 4. AGRICULTURAL ACTIVITIES
  // ==========================================

  it('15. Creates an agricultural activity for farm, plot and crop', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/activities`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        farmId,
        plotId: plot2Id,
        cropId: crop2Id,
        activityTypeId: 'act_irrigation',
        customActivityName: 'ठिबक सिंचन पाणी देणे',
        description: 'उसाला ३ तास ठिबक सिंचन दिले',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.activityNameMr).toBe('पाणी देणे');
    expect(res.body.data.events.length).toBe(1);
    expect(res.body.data.events[0].eventType).toBe('created');
    activityId = res.body.data.id;
  });

  it('16. Executes full activity lifecycle (start -> pause -> resume -> complete)', async () => {
    // 1. Start activity
    const rStart = await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ transition: 'start', notes: 'सकाळी ८:३० वाजता काम सुरू केले' });

    expect(rStart.status).toBe(200);
    expect(rStart.body.data.status).toBe('in_progress');

    // 2. Pause activity
    const rPause = await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ transition: 'pause', notes: 'विद्युत पुरवठा खंडित झाला' });

    expect(rPause.status).toBe(200);
    expect(rPause.body.data.status).toBe('paused');

    // 3. Resume activity
    const rResume = await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ transition: 'resume', notes: 'लाईट आल्यावर पुन्हा सुरू' });

    expect(rResume.status).toBe(200);
    expect(rResume.body.data.status).toBe('in_progress');

    // 4. Complete activity
    const rComplete = await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ transition: 'complete', notes: 'पाणी व्यवस्थित भरले' });

    expect(rComplete.status).toBe(200);
    expect(rComplete.body.data.status).toBe('completed');
    expect(rComplete.body.data.events.length).toBe(5); // created, start, pause, resume, complete
  });

  it('17. Rejects invalid transition on finished activity', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ transition: 'pause' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  // ==========================================
  // 5. CROSS-GROUP ISOLATION
  // ==========================================

  it('18. Outsider is forbidden from accessing farms, plots, crops and activities', async () => {
    // 1. Farms
    const fRes = await request(app)
      .get(`/api/v1/groups/${groupId}/farms`)
      .set('Cookie', outsiderCookie);
    expect(fRes.status).toBe(403);

    // 2. Plots
    const pRes = await request(app)
      .get(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('Cookie', outsiderCookie);
    expect(pRes.status).toBe(403);

    // 3. Crops
    const cRes = await request(app)
      .get(`/api/v1/groups/${groupId}/crops`)
      .set('Cookie', outsiderCookie);
    expect(cRes.status).toBe(403);

    // 4. Activities
    const aRes = await request(app)
      .get(`/api/v1/groups/${groupId}/activities`)
      .set('Cookie', outsiderCookie);
    expect(aRes.status).toBe(403);
  });

  // ==========================================
  // 6. ARCHIVAL & HISTORICAL PRESERVATION
  // ==========================================

  it('19. Soft-archives farm and preserves historical records', async () => {
    const res = await request(app)
      .delete(`/api/v1/groups/${groupId}/farms/${farmId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Farm is no longer in active listing
    const listRes = await request(app)
      .get(`/api/v1/groups/${groupId}/farms`)
      .set('Cookie', memberCookie);
    expect(listRes.body.data.length).toBe(0);

    // Historical record still preserved in DB
    const client = getDatabaseClient();
    const dbFarm = await client.execute({
      sql: 'SELECT id, is_active FROM farms WHERE id = ?',
      args: [farmId],
    });
    expect(dbFarm.rows[0].is_active).toBe(0);
  });
});
