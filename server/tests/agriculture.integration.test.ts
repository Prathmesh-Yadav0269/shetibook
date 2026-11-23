import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('ShetiBook Phase 2 - End-to-End Agricultural Flow Integration Test', () => {
  const ownerPhone = '9777711111';
  const memberPhone = '9777722222';
  const outsiderPhone = '9777733333';
  const password = 'FarmPassword123';

  let ownerCookie = '';
  let memberCookie = '';
  let outsiderCookie = '';
  let groupId = '';
  let farmId = '';
  let plotId = '';
  let crop1Id = '';
  let crop2Id = '';
  let activityId = '';

  it('Step 1: Register and login Owner, Family Member and Outsider', async () => {
    // Register owner
    await request(app).post('/api/v1/auth/register').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: ownerPhone, password, confirmPassword: password });
    const l1 = await request(app).post('/api/v1/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: ownerPhone, password });
    ownerCookie = (l1.headers['set-cookie'] as unknown as string[])[0];

    // Register member
    await request(app).post('/api/v1/auth/register').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: memberPhone, password, confirmPassword: password });
    const l2 = await request(app).post('/api/v1/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: memberPhone, password });
    memberCookie = (l2.headers['set-cookie'] as unknown as string[])[0];

    // Register outsider
    await request(app).post('/api/v1/auth/register').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: outsiderPhone, password, confirmPassword: password });
    const l3 = await request(app).post('/api/v1/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: outsiderPhone, password });
    outsiderCookie = (l3.headers['set-cookie'] as unknown as string[])[0];

    expect(ownerCookie).toBeDefined();
    expect(memberCookie).toBeDefined();
    expect(outsiderCookie).toBeDefined();
  });

  it('Step 2: Owner creates farming group and invites Member', async () => {
    const groupRes = await request(app)
      .post('/api/v1/groups')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ name: 'कदम शेती परिवार (Kadam Family Farm)' });

    expect(groupRes.status).toBe(201);
    groupId = groupRes.body.data.id;

    // Create invitation
    const invRes = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ intendedPhone: memberPhone });

    expect(invRes.status).toBe(201);
    const token = invRes.body.data.token;

    // Member joins group
    const joinRes = await request(app)
      .post('/api/v1/groups/join')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ token });

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.success).toBe(true);
  });

  it('Step 3: Create a farm (10 acres)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/farms`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmName: 'नदीकाठची शेतजमीन (Riverside Farm)',
        village: 'फलटण (Phaltan)',
        taluka: 'फलटण',
        district: 'सातारा',
        areaValue: 10,
        areaUnit: 'acre',
        surveyNumber: '45/B',
        notes: 'कॅनॉलचे पाणी उपलब्ध',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.areaValue).toBe(10);
    expect(res.body.data.breakdown.guntha).toBe(400);
    farmId = res.body.data.id;
  });

  it('Step 4 & 5: Add physical plot and set intercropping mode (4 acres)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        plotName: 'प्लॉट १ (Plot 1)',
        areaValue: 4,
        areaUnit: 'acre',
        cultivationMode: 'intercropping',
        notes: 'ऊस + हरभरा आंतरपीक',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.cultivationMode).toBe('intercropping');
    plotId = res.body.data.id;
  });

  it('Step 6: Add two crops to the same intercropping plot', async () => {
    // Crop 1: Sugarcane
    const c1Res = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        plotId,
        cropTypeId: 'crop_sugarcane',
        cropSeasonId: 'season_perennial',
        cropNameCustom: 'को ८६०३२ ऊस',
        sowingDate: '2026-10-10',
        expectedHarvestDate: '2027-10-10',
      });

    expect(c1Res.status).toBe(201);
    crop1Id = c1Res.body.data.id;

    // Crop 2: Chickpea (Intercrop)
    const c2Res = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        plotId,
        cropTypeId: 'crop_chickpea',
        cropSeasonId: 'season_rabi',
        cropNameCustom: 'दिग्विजय हरभरा आंतरपीक',
        sowingDate: '2026-10-25',
        expectedHarvestDate: '2027-02-25',
      });

    expect(c2Res.status).toBe(201);
    crop2Id = c2Res.body.data.id;

    // Verify both crops exist under the same plot
    const cropsList = await request(app)
      .get(`/api/v1/groups/${groupId}/crops?plotId=${plotId}`)
      .set('Cookie', ownerCookie);

    expect(cropsList.status).toBe(200);
    expect(cropsList.body.data.length).toBe(2);
  });

  it('Step 7: Create an activity for one of the crops', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/activities`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        plotId,
        cropId: crop1Id,
        activityTypeId: 'act_fertilizer',
        customActivityName: 'युरिया आणि डीएपी खत देणे',
        description: 'उसाला पहिली खत मात्रा दिली',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    activityId = res.body.data.id;
  });

  it('Step 8 & 9: Start and pause the activity, verify event history', async () => {
    // Start activity
    const rStart = await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ transition: 'start', notes: 'सकाळी काम सुरू' });

    expect(rStart.status).toBe(200);
    expect(rStart.body.data.status).toBe('in_progress');

    // Pause activity
    const rPause = await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ transition: 'pause', notes: 'दुपारची जेवणाची सुट्टी' });

    expect(rPause.status).toBe(200);
    expect(rPause.body.data.status).toBe('paused');

    // Verify timeline events
    const details = await request(app)
      .get(`/api/v1/groups/${groupId}/activities/${activityId}`)
      .set('Cookie', ownerCookie);

    expect(details.status).toBe(200);
    expect(details.body.data.events.length).toBe(3); // created, started, paused
    expect(details.body.data.events.map((e: { eventType: string }) => e.eventType)).toEqual([
      'created',
      'started',
      'paused',
    ]);
  });

  it('Step 10: Confirm another active group member can access the shared records', async () => {
    // Member views farms
    const fRes = await request(app)
      .get(`/api/v1/groups/${groupId}/farms`)
      .set('Cookie', memberCookie);
    expect(fRes.status).toBe(200);
    expect(fRes.body.data.length).toBe(1);
    expect(fRes.body.data[0].id).toBe(farmId);

    // Member views plots
    const pRes = await request(app)
      .get(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('Cookie', memberCookie);
    expect(pRes.status).toBe(200);
    expect(pRes.body.data.length).toBe(1);

    // Member views activities
    const aRes = await request(app)
      .get(`/api/v1/groups/${groupId}/activities/${activityId}`)
      .set('Cookie', memberCookie);
    expect(aRes.status).toBe(200);
    expect(aRes.body.data.status).toBe('paused');
  });

  it('Step 11: Confirm an outsider cannot access any of those records', async () => {
    // Outsider cannot view farm
    const fRes = await request(app)
      .get(`/api/v1/groups/${groupId}/farms/${farmId}`)
      .set('Cookie', outsiderCookie);
    expect(fRes.status).toBe(403);
    expect(fRes.body.error.code).toBe('FORBIDDEN_GROUP_ACCESS');

    // Outsider cannot view crops
    const cRes = await request(app)
      .get(`/api/v1/groups/${groupId}/crops`)
      .set('Cookie', outsiderCookie);
    expect(cRes.status).toBe(403);
    expect(cRes.body.error.code).toBe('FORBIDDEN_GROUP_ACCESS');

    // Outsider cannot view activity
    const aRes = await request(app)
      .get(`/api/v1/groups/${groupId}/activities/${activityId}`)
      .set('Cookie', outsiderCookie);
    expect(aRes.status).toBe(403);
    expect(aRes.body.error.code).toBe('FORBIDDEN_GROUP_ACCESS');
  });
});
