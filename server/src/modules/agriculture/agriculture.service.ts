import crypto from 'crypto';
import type { InValue } from '@libsql/client';
import { getDatabaseClient } from '../../database/client.js';
import { AppError } from '../../middleware/error.middleware.js';
import { logger } from '../../utils/logger.js';
import {
  toSquareMeters,
  fromSquareMeters,
  calculateAreaBreakdown,
  AreaUnit,
} from '../../utils/area.js';
import { NotificationService } from '../notifications/notification.service.js';

export class AgricultureService {
  private notificationService = new NotificationService();
  // ==========================================
  // 1. FARMS
  // ==========================================

  async createFarm(
    groupId: string,
    userId: string,
    data: {
      farmName: string;
      village: string;
      taluka?: string | null;
      district?: string | null;
      areaValue: number;
      areaUnit: AreaUnit;
      surveyNumber?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();
    const farmId = crypto.randomUUID();
    const now = new Date().toISOString();
    const areaSqm = toSquareMeters(data.areaValue, data.areaUnit);

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          INSERT INTO farms (
            id, group_id, farm_name, village, taluka, district,
            area_value, area_unit, area_sqm, survey_number,
            latitude, longitude, notes, created_by, created_at, updated_at, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
        args: [
          farmId,
          groupId,
          data.farmName.trim(),
          data.village.trim(),
          data.taluka?.trim() || null,
          data.district?.trim() || null,
          data.areaValue,
          data.areaUnit,
          areaSqm,
          data.surveyNumber?.trim() || null,
          data.latitude || null,
          data.longitude || null,
          data.notes?.trim() || null,
          userId,
          now,
          now,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'FARM_CREATED', 'farm', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          farmId,
          JSON.stringify({ farmName: data.farmName, areaValue: data.areaValue, areaUnit: data.areaUnit }),
          ip || null,
          userAgent || null,
          now,
        ],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    logger.info('Farm created', { farmId, groupId, userId });

    return {
      id: farmId,
      groupId,
      farmName: data.farmName.trim(),
      village: data.village.trim(),
      areaValue: data.areaValue,
      areaUnit: data.areaUnit,
      areaSqm,
      breakdown: calculateAreaBreakdown(data.areaValue, data.areaUnit),
      createdAt: now,
    };
  }

  async listFarms(groupId: string) {
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: `
        SELECT 
          f.*,
          COALESCE(p.plot_count, 0) as plot_count,
          COALESCE(p.allocated_sqm, 0) as allocated_sqm,
          COALESCE(c.active_crop_count, 0) as active_crop_count
        FROM farms f
        LEFT JOIN (
          SELECT farm_id, COUNT(*) as plot_count, SUM(area_sqm) as allocated_sqm
          FROM cultivation_plots
          WHERE is_active = 1
          GROUP BY farm_id
        ) p ON p.farm_id = f.id
        LEFT JOIN (
          SELECT farm_id, COUNT(*) as active_crop_count
          FROM crops
          WHERE status IN ('planned', 'active')
          GROUP BY farm_id
        ) c ON c.farm_id = f.id
        WHERE f.group_id = ? AND f.is_active = 1
        ORDER BY f.created_at ASC
      `,
      args: [groupId],
    });

    return result.rows.map(row => {
      const areaValue = Number(row.area_value);
      const areaUnit = String(row.area_unit) as AreaUnit;
      const areaSqm = Number(row.area_sqm);
      const allocatedSqm = Number(row.allocated_sqm);
      const unallocatedSqm = Math.max(0, areaSqm - allocatedSqm);

      return {
        id: String(row.id),
        groupId: String(row.group_id),
        farmName: String(row.farm_name),
        village: String(row.village),
        taluka: row.taluka ? String(row.taluka) : null,
        district: row.district ? String(row.district) : null,
        areaValue,
        areaUnit,
        areaSqm,
        surveyNumber: row.survey_number ? String(row.survey_number) : null,
        notes: row.notes ? String(row.notes) : null,
        plotCount: Number(row.plot_count),
        activeCropCount: Number(row.active_crop_count),
        allocatedSqm,
        unallocatedSqm,
        allocatedInUnit: Number(fromSquareMeters(allocatedSqm, areaUnit).toFixed(2)),
        unallocatedInUnit: Number(fromSquareMeters(unallocatedSqm, areaUnit).toFixed(2)),
        breakdown: calculateAreaBreakdown(areaValue, areaUnit),
        createdAt: String(row.created_at),
      };
    });
  }

  async getFarmDetails(groupId: string, farmId: string) {
    const client = getDatabaseClient();

    const farmResult = await client.execute({
      sql: 'SELECT * FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [farmId, groupId],
    });

    if (farmResult.rows.length === 0) {
      throw new AppError('Farm not found or has been archived.', 404, 'FARM_NOT_FOUND');
    }

    const farm = farmResult.rows[0];
    const areaValue = Number(farm.area_value);
    const areaUnit = String(farm.area_unit) as AreaUnit;
    const areaSqm = Number(farm.area_sqm);

    // Fetch active plots
    const plotsResult = await client.execute({
      sql: `
        SELECT 
          p.*,
          COALESCE(c.crop_count, 0) as crop_count
        FROM cultivation_plots p
        LEFT JOIN (
          SELECT plot_id, COUNT(*) as crop_count
          FROM crops
          WHERE status IN ('planned', 'active')
          GROUP BY plot_id
        ) c ON c.plot_id = p.id
        WHERE p.farm_id = ? AND p.group_id = ? AND p.is_active = 1
        ORDER BY p.plot_name ASC
      `,
      args: [farmId, groupId],
    });

    const plots = plotsResult.rows.map(p => ({
      id: String(p.id),
      farmId: String(p.farm_id),
      plotName: String(p.plot_name),
      areaValue: Number(p.area_value),
      areaUnit: String(p.area_unit) as AreaUnit,
      areaSqm: Number(p.area_sqm),
      cultivationMode: String(p.cultivation_mode),
      notes: p.notes ? String(p.notes) : null,
      cropCount: Number(p.crop_count),
      breakdown: calculateAreaBreakdown(Number(p.area_value), String(p.area_unit) as AreaUnit),
      createdAt: String(p.created_at),
    }));

    const allocatedSqm = plots.reduce((sum, p) => sum + p.areaSqm, 0);
    const unallocatedSqm = Math.max(0, areaSqm - allocatedSqm);

    return {
      id: String(farm.id),
      groupId: String(farm.group_id),
      farmName: String(farm.farm_name),
      village: String(farm.village),
      taluka: farm.taluka ? String(farm.taluka) : null,
      district: farm.district ? String(farm.district) : null,
      areaValue,
      areaUnit,
      areaSqm,
      surveyNumber: farm.survey_number ? String(farm.survey_number) : null,
      notes: farm.notes ? String(farm.notes) : null,
      plots,
      allocatedSqm,
      unallocatedSqm,
      allocatedInUnit: Number(fromSquareMeters(allocatedSqm, areaUnit).toFixed(2)),
      unallocatedInUnit: Number(fromSquareMeters(unallocatedSqm, areaUnit).toFixed(2)),
      breakdown: calculateAreaBreakdown(areaValue, areaUnit),
      createdAt: String(farm.created_at),
    };
  }

  async updateFarm(
    groupId: string,
    farmId: string,
    userId: string,
    data: {
      farmName?: string;
      village?: string;
      taluka?: string | null;
      district?: string | null;
      areaValue?: number;
      areaUnit?: AreaUnit;
      surveyNumber?: string | null;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    const existingResult = await client.execute({
      sql: 'SELECT * FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [farmId, groupId],
    });

    if (existingResult.rows.length === 0) {
      throw new AppError('Farm not found.', 404, 'FARM_NOT_FOUND');
    }

    const existing = existingResult.rows[0];
    const newAreaValue = data.areaValue ?? Number(existing.area_value);
    const newAreaUnit = (data.areaUnit ?? existing.area_unit) as AreaUnit;
    const newAreaSqm = toSquareMeters(newAreaValue, newAreaUnit);

    // Verify new farm area is not less than the sum of existing active plots
    const allocatedResult = await client.execute({
      sql: 'SELECT COALESCE(SUM(area_sqm), 0) as total FROM cultivation_plots WHERE farm_id = ? AND is_active = 1',
      args: [farmId],
    });
    const totalAllocatedSqm = Number(allocatedResult.rows[0].total);

    if (newAreaSqm < totalAllocatedSqm - 0.01) {
      throw new AppError(
        'Farm area cannot be reduced below the total area of existing active plots.',
        400,
        'FARM_AREA_TOO_SMALL'
      );
    }

    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          UPDATE farms
          SET farm_name = ?, village = ?, taluka = ?, district = ?,
              area_value = ?, area_unit = ?, area_sqm = ?, survey_number = ?,
              notes = ?, updated_at = ?
          WHERE id = ? AND group_id = ?
        `,
        args: [
          (data.farmName ?? String(existing.farm_name || '')).trim(),
          (data.village ?? String(existing.village || '')).trim(),
          data.taluka !== undefined ? data.taluka?.trim() || null : existing.taluka,
          data.district !== undefined ? data.district?.trim() || null : existing.district,
          newAreaValue,
          newAreaUnit,
          newAreaSqm,
          data.surveyNumber !== undefined ? data.surveyNumber?.trim() || null : existing.survey_number,
          data.notes !== undefined ? data.notes?.trim() || null : existing.notes,
          now,
          farmId,
          groupId,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
          VALUES (?, ?, 'FARM_UPDATED', 'farm', ?, ?, ?, ?)
        `,
        args: [crypto.randomUUID(), userId, farmId, ip || null, userAgent || null, now],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    return this.getFarmDetails(groupId, farmId);
  }

  async archiveFarm(groupId: string, farmId: string, userId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();

    const check = await client.execute({
      sql: 'SELECT id, farm_name FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [farmId, groupId],
    });

    if (check.rows.length === 0) {
      throw new AppError('Farm not found or already archived.', 404, 'FARM_NOT_FOUND');
    }

    const txn = await client.transaction('write');
    try {
      // Soft-archive farm (preserves all historical plots, crops and activities)
      await txn.execute({
        sql: 'UPDATE farms SET is_active = 0, updated_at = ? WHERE id = ? AND group_id = ?',
        args: [now, farmId, groupId],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'FARM_ARCHIVED', 'farm', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          farmId,
          JSON.stringify({ farmName: check.rows[0].farm_name }),
          ip || null,
          userAgent || null,
          now,
        ],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    logger.info('Farm archived safely', { farmId, groupId, userId });
    return { success: true, farmId };
  }

  // ==========================================
  // 2. CULTIVATION PLOTS
  // ==========================================

  async createPlot(
    groupId: string,
    farmId: string,
    userId: string,
    data: {
      plotName: string;
      areaValue: number;
      areaUnit: AreaUnit;
      cultivationMode: 'separate' | 'intercropping';
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    // Verify farm
    const farmResult = await client.execute({
      sql: 'SELECT id, area_sqm FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [farmId, groupId],
    });

    if (farmResult.rows.length === 0) {
      throw new AppError('Farm not found.', 404, 'FARM_NOT_FOUND');
    }

    const farm = farmResult.rows[0];
    const farmAreaSqm = Number(farm.area_sqm);
    const plotSqm = toSquareMeters(data.areaValue, data.areaUnit);

    // Check duplicate active plot name on this farm
    const dupCheck = await client.execute({
      sql: 'SELECT id FROM cultivation_plots WHERE farm_id = ? AND plot_name = ? AND is_active = 1',
      args: [farmId, data.plotName.trim()],
    });

    if (dupCheck.rows.length > 0) {
      throw new AppError('A plot with this name already exists on this farm.', 409, 'DUPLICATE_PLOT_NAME');
    }

    // Check total allocation constraint
    const allocatedResult = await client.execute({
      sql: 'SELECT COALESCE(SUM(area_sqm), 0) as total FROM cultivation_plots WHERE farm_id = ? AND is_active = 1',
      args: [farmId],
    });
    const currentAllocatedSqm = Number(allocatedResult.rows[0].total);

    if (currentAllocatedSqm + plotSqm > farmAreaSqm + 0.01) {
      throw new AppError(
        'Plot area exceeds available unallocated farm area.',
        400,
        'PLOT_AREA_EXCEEDS_FARM'
      );
    }

    const plotId = crypto.randomUUID();
    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          INSERT INTO cultivation_plots (
            id, farm_id, group_id, plot_name, area_value, area_unit,
            area_sqm, cultivation_mode, notes, created_by, created_at, updated_at, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
        args: [
          plotId,
          farmId,
          groupId,
          data.plotName.trim(),
          data.areaValue,
          data.areaUnit,
          plotSqm,
          data.cultivationMode,
          data.notes?.trim() || null,
          userId,
          now,
          now,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'PLOT_CREATED', 'cultivation_plot', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          plotId,
          JSON.stringify({ plotName: data.plotName, farmId, cultivationMode: data.cultivationMode }),
          ip || null,
          userAgent || null,
          now,
        ],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    logger.info('Plot created', { plotId, farmId, groupId });

    return {
      id: plotId,
      farmId,
      groupId,
      plotName: data.plotName.trim(),
      areaValue: data.areaValue,
      areaUnit: data.areaUnit,
      areaSqm: plotSqm,
      cultivationMode: data.cultivationMode,
      breakdown: calculateAreaBreakdown(data.areaValue, data.areaUnit),
      createdAt: now,
    };
  }

  async listPlots(groupId: string, farmId?: string) {
    const client = getDatabaseClient();

    if (farmId) {
      // Verify farm belongs to group
      const farmResult = await client.execute({
        sql: 'SELECT id, farm_name FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
        args: [farmId, groupId],
      });

      if (farmResult.rows.length === 0) {
        throw new AppError('Farm not found.', 404, 'FARM_NOT_FOUND');
      }
    }

    let plotsSql = `
      SELECT p.*
      FROM cultivation_plots p
      WHERE p.group_id = ? AND p.is_active = 1
    `;
    const plotsArgs: InValue[] = [groupId];
    if (farmId) {
      plotsSql += ' AND p.farm_id = ?';
      plotsArgs.push(farmId);
    }
    plotsSql += ' ORDER BY p.plot_name ASC';

    const plotsResult = await client.execute({ sql: plotsSql, args: plotsArgs });

    // Fetch active crops for each plot
    let cropsSql = `
      SELECT c.id, c.plot_id, c.crop_name_custom, c.sowing_date, c.status,
             ct.crop_name_mr, ct.crop_name_en, cs.season_name_mr, cs.season_name_en
      FROM crops c
      JOIN crop_types ct ON ct.id = c.crop_type_id
      JOIN crop_seasons cs ON cs.id = c.crop_season_id
      WHERE c.group_id = ? AND c.status IN ('planned', 'active')
    `;
    const cropsArgs: InValue[] = [groupId];
    if (farmId) {
      cropsSql += ' AND c.farm_id = ?';
      cropsArgs.push(farmId);
    }
    cropsSql += ' ORDER BY c.sowing_date DESC';

    const cropsResult = await client.execute({ sql: cropsSql, args: cropsArgs });

    const cropsByPlot: Record<string, Array<Record<string, unknown>>> = {};
    for (const crop of cropsResult.rows) {
      const pId = String(crop.plot_id);
      if (!cropsByPlot[pId]) cropsByPlot[pId] = [];
      cropsByPlot[pId].push({
        id: String(crop.id),
        cropNameCustom: crop.crop_name_custom ? String(crop.crop_name_custom) : null,
        cropNameMr: String(crop.crop_name_mr),
        cropNameEn: String(crop.crop_name_en),
        seasonNameMr: String(crop.season_name_mr),
        seasonNameEn: String(crop.season_name_en),
        sowingDate: String(crop.sowing_date),
        status: String(crop.status),
      });
    }

    return plotsResult.rows.map(p => {
      const pId = String(p.id);
      const areaValue = Number(p.area_value);
      const areaUnit = String(p.area_unit) as AreaUnit;
      const activeCrops = cropsByPlot[pId] || [];

      return {
        id: pId,
        farmId: String(p.farm_id),
        plotName: String(p.plot_name),
        areaValue,
        areaUnit,
        areaSqm: Number(p.area_sqm),
        cultivationMode: String(p.cultivation_mode),
        notes: p.notes ? String(p.notes) : null,
        activeCrops,
        activeCropCount: activeCrops.length,
        breakdown: calculateAreaBreakdown(areaValue, areaUnit),
        createdAt: String(p.created_at),
      };
    });
  }

  async getPlotDetails(groupId: string, plotId: string) {
    const client = getDatabaseClient();

    const plotResult = await client.execute({
      sql: `
        SELECT p.*, f.farm_name, f.village, f.area_unit as farm_area_unit
        FROM cultivation_plots p
        JOIN farms f ON f.id = p.farm_id
        WHERE p.id = ? AND p.group_id = ? AND p.is_active = 1
      `,
      args: [plotId, groupId],
    });

    if (plotResult.rows.length === 0) {
      throw new AppError('Plot not found.', 404, 'PLOT_NOT_FOUND');
    }

    const plot = plotResult.rows[0];

    // Fetch all crops for this plot
    const cropsResult = await client.execute({
      sql: `
        SELECT c.*, ct.crop_name_mr, ct.crop_name_en, cs.season_name_mr, cs.season_name_en
        FROM crops c
        JOIN crop_types ct ON ct.id = c.crop_type_id
        JOIN crop_seasons cs ON cs.id = c.crop_season_id
        WHERE c.plot_id = ? AND c.group_id = ?
        ORDER BY c.sowing_date DESC
      `,
      args: [plotId, groupId],
    });

    const crops = cropsResult.rows.map(c => ({
      id: String(c.id),
      cropNameCustom: c.crop_name_custom ? String(c.crop_name_custom) : null,
      cropNameMr: String(c.crop_name_mr),
      cropNameEn: String(c.crop_name_en),
      seasonNameMr: String(c.season_name_mr),
      seasonNameEn: String(c.season_name_en),
      sowingDate: String(c.sowing_date),
      expectedHarvestDate: c.expected_harvest_date ? String(c.expected_harvest_date) : null,
      actualHarvestDate: c.actual_harvest_date ? String(c.actual_harvest_date) : null,
      status: String(c.status),
      notes: c.notes ? String(c.notes) : null,
      createdAt: String(c.created_at),
    }));

    return {
      id: String(plot.id),
      farmId: String(plot.farm_id),
      farmName: String(plot.farm_name),
      village: String(plot.village),
      plotName: String(plot.plot_name),
      areaValue: Number(plot.area_value),
      areaUnit: String(plot.area_unit) as AreaUnit,
      areaSqm: Number(plot.area_sqm),
      cultivationMode: String(plot.cultivation_mode),
      notes: plot.notes ? String(plot.notes) : null,
      crops,
      breakdown: calculateAreaBreakdown(Number(plot.area_value), String(plot.area_unit) as AreaUnit),
      createdAt: String(plot.created_at),
    };
  }

  async updatePlot(
    groupId: string,
    plotId: string,
    userId: string,
    data: {
      plotName?: string;
      areaValue?: number;
      areaUnit?: AreaUnit;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    const existingResult = await client.execute({
      sql: 'SELECT * FROM cultivation_plots WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [plotId, groupId],
    });

    if (existingResult.rows.length === 0) {
      throw new AppError('Plot not found.', 404, 'PLOT_NOT_FOUND');
    }

    const existing = existingResult.rows[0];
    const farmId = String(existing.farm_id);
    const newAreaValue = data.areaValue ?? Number(existing.area_value);
    const newAreaUnit = (data.areaUnit ?? existing.area_unit) as AreaUnit;
    const newAreaSqm = toSquareMeters(newAreaValue, newAreaUnit);

    // If name changed, check duplicate active plot name
    if (data.plotName && data.plotName.trim() !== String(existing.plot_name)) {
      const dup = await client.execute({
        sql: 'SELECT id FROM cultivation_plots WHERE farm_id = ? AND plot_name = ? AND id != ? AND is_active = 1',
        args: [farmId, data.plotName.trim(), plotId],
      });
      if (dup.rows.length > 0) {
        throw new AppError('Another plot on this farm already has this name.', 409, 'DUPLICATE_PLOT_NAME');
      }
    }

    // Check farm area allocation constraint
    const farmResult = await client.execute({
      sql: 'SELECT area_sqm FROM farms WHERE id = ? AND is_active = 1',
      args: [farmId],
    });
    const farmAreaSqm = Number(farmResult.rows[0].area_sqm);

    const otherPlots = await client.execute({
      sql: 'SELECT COALESCE(SUM(area_sqm), 0) as total FROM cultivation_plots WHERE farm_id = ? AND id != ? AND is_active = 1',
      args: [farmId, plotId],
    });
    const otherPlotsSqm = Number(otherPlots.rows[0].total);

    if (otherPlotsSqm + newAreaSqm > farmAreaSqm + 0.01) {
      throw new AppError('Updated plot area exceeds available farm area.', 400, 'PLOT_AREA_EXCEEDS_FARM');
    }

    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          UPDATE cultivation_plots
          SET plot_name = ?, area_value = ?, area_unit = ?, area_sqm = ?, notes = ?, updated_at = ?
          WHERE id = ? AND group_id = ?
        `,
        args: [
          (data.plotName ?? String(existing.plot_name || '')).trim(),
          newAreaValue,
          newAreaUnit,
          newAreaSqm,
          data.notes !== undefined ? data.notes?.trim() || null : existing.notes,
          now,
          plotId,
          groupId,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
          VALUES (?, ?, 'PLOT_UPDATED', 'cultivation_plot', ?, ?, ?, ?)
        `,
        args: [crypto.randomUUID(), userId, plotId, ip || null, userAgent || null, now],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    return this.getPlotDetails(groupId, plotId);
  }

  async archivePlot(groupId: string, plotId: string, userId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();

    const check = await client.execute({
      sql: 'SELECT id, plot_name, farm_id FROM cultivation_plots WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [plotId, groupId],
    });

    if (check.rows.length === 0) {
      throw new AppError('Plot not found or already archived.', 404, 'PLOT_NOT_FOUND');
    }

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: 'UPDATE cultivation_plots SET is_active = 0, updated_at = ? WHERE id = ? AND group_id = ?',
        args: [now, plotId, groupId],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'PLOT_ARCHIVED', 'cultivation_plot', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          plotId,
          JSON.stringify({ plotName: check.rows[0].plot_name, farmId: check.rows[0].farm_id }),
          ip || null,
          userAgent || null,
          now,
        ],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    logger.info('Plot archived safely', { plotId, groupId, userId });
    return { success: true, plotId };
  }

  async changeCultivationMode(
    groupId: string,
    plotId: string,
    userId: string,
    newMode: 'separate' | 'intercropping',
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    const check = await client.execute({
      sql: 'SELECT id, cultivation_mode FROM cultivation_plots WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [plotId, groupId],
    });

    if (check.rows.length === 0) {
      throw new AppError('Plot not found.', 404, 'PLOT_NOT_FOUND');
    }

    const currentMode = String(check.rows[0].cultivation_mode);
    if (currentMode === newMode) {
      return { success: true, plotId, cultivationMode: newMode };
    }

    // If changing to 'separate', prevent if multiple active crops exist
    if (newMode === 'separate') {
      const activeCrops = await client.execute({
        sql: `SELECT COUNT(*) as count FROM crops WHERE plot_id = ? AND status IN ('planned', 'active')`,
        args: [plotId],
      });
      const activeCount = Number(activeCrops.rows[0].count);
      if (activeCount > 1) {
        throw new AppError(
          'Cannot switch to separate mode while plot has multiple active crops. Harvest or cancel extra crops first.',
          400,
          'MULTIPLE_ACTIVE_CROPS'
        );
      }
    }

    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: 'UPDATE cultivation_plots SET cultivation_mode = ?, updated_at = ? WHERE id = ?',
        args: [newMode, now, plotId],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'PLOT_MODE_CHANGED', 'cultivation_plot', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          plotId,
          JSON.stringify({ previousMode: currentMode, newMode }),
          ip || null,
          userAgent || null,
          now,
        ],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    logger.info('Plot cultivation mode changed', { plotId, previousMode: currentMode, newMode });

    return { success: true, plotId, cultivationMode: newMode };
  }

  // ==========================================
  // 3. CROPS & METADATA
  // ==========================================

  async getMetadata() {
    const client = getDatabaseClient();

    const [typesResult, seasonsResult] = await Promise.all([
      client.execute('SELECT id, crop_name_mr, crop_name_en FROM crop_types WHERE is_active = 1 ORDER BY crop_name_mr ASC'),
      client.execute('SELECT id, season_name_mr, season_name_en, start_month, end_month FROM crop_seasons WHERE is_active = 1 ORDER BY id ASC'),
    ]);

    return {
      cropTypes: typesResult.rows.map(t => ({
        id: String(t.id),
        nameMr: String(t.crop_name_mr),
        nameEn: String(t.crop_name_en),
      })),
      cropSeasons: seasonsResult.rows.map(s => ({
        id: String(s.id),
        nameMr: String(s.season_name_mr),
        nameEn: String(s.season_name_en),
        startMonth: s.start_month ? Number(s.start_month) : null,
        endMonth: s.end_month ? Number(s.end_month) : null,
      })),
    };
  }

  async createCrop(
    groupId: string,
    userId: string,
    data: {
      farmId: string;
      plotId: string;
      cropTypeId: string;
      cropSeasonId: string;
      cropNameCustom?: string | null;
      sowingDate: string;
      expectedHarvestDate?: string | null;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    // Verify farm belongs to group and is active
    const farmResult = await client.execute({
      sql: 'SELECT id FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [data.farmId, groupId],
    });
    if (farmResult.rows.length === 0) {
      throw new AppError('Farm not found.', 404, 'FARM_NOT_FOUND');
    }

    // Verify plot belongs to farm and group, and is active
    const plotResult = await client.execute({
      sql: 'SELECT id, cultivation_mode FROM cultivation_plots WHERE id = ? AND farm_id = ? AND group_id = ? AND is_active = 1',
      args: [data.plotId, data.farmId, groupId],
    });
    if (plotResult.rows.length === 0) {
      throw new AppError('Plot not found or does not belong to the selected farm.', 404, 'PLOT_NOT_FOUND');
    }

    const plot = plotResult.rows[0];

    // Enforce Separate Cultivation Mode rule: strictly 1 active/planned crop on plot
    if (plot.cultivation_mode === 'separate') {
      const activeCrops = await client.execute({
        sql: `SELECT id FROM crops WHERE plot_id = ? AND status IN ('planned', 'active')`,
        args: [data.plotId],
      });
      if (activeCrops.rows.length > 0) {
        throw new AppError(
          'Plot is in separate cultivation mode and already has an active crop. Use intercropping or harvest the existing crop first.',
          400,
          'SEPARATE_MODE_SINGLE_CROP'
        );
      }
    }

    const cropId = crypto.randomUUID();
    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          INSERT INTO crops (
            id, group_id, farm_id, plot_id, crop_type_id, crop_season_id,
            crop_name_custom, sowing_date, expected_harvest_date, status,
            notes, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?)
        `,
        args: [
          cropId,
          groupId,
          data.farmId,
          data.plotId,
          data.cropTypeId,
          data.cropSeasonId,
          data.cropNameCustom?.trim() || null,
          data.sowingDate,
          data.expectedHarvestDate || null,
          data.notes?.trim() || null,
          userId,
          now,
          now,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'CROP_CREATED', 'crop', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          cropId,
          JSON.stringify({ plotId: data.plotId, cropTypeId: data.cropTypeId, sowingDate: data.sowingDate }),
          ip || null,
          userAgent || null,
          now,
        ],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    logger.info('Crop registered', { cropId, plotId: data.plotId, groupId });
    return this.getCropDetails(groupId, cropId);
  }

  async listCrops(
    groupId: string,
    filters: { farmId?: string; plotId?: string; status?: string }
  ) {
    const client = getDatabaseClient();

    let sql = `
      SELECT 
        c.*,
        ct.crop_name_mr, ct.crop_name_en,
        cs.season_name_mr, cs.season_name_en,
        p.plot_name, p.cultivation_mode, p.area_value as plot_area_value, p.area_unit as plot_area_unit,
        f.farm_name, f.village
      FROM crops c
      JOIN crop_types ct ON ct.id = c.crop_type_id
      JOIN crop_seasons cs ON cs.id = c.crop_season_id
      JOIN cultivation_plots p ON p.id = c.plot_id
      JOIN farms f ON f.id = c.farm_id
      WHERE c.group_id = ?
    `;
    const args: InValue[] = [groupId];

    if (filters.farmId) {
      sql += ' AND c.farm_id = ?';
      args.push(filters.farmId);
    }
    if (filters.plotId) {
      sql += ' AND c.plot_id = ?';
      args.push(filters.plotId);
    }
    if (filters.status) {
      sql += ' AND c.status = ?';
      args.push(filters.status);
    }

    sql += ' ORDER BY c.sowing_date DESC, c.created_at DESC';

    const result = await client.execute({ sql, args });

    return result.rows.map(row => ({
      id: String(row.id),
      groupId: String(row.group_id),
      farmId: String(row.farm_id),
      farmName: String(row.farm_name),
      village: String(row.village),
      plotId: String(row.plot_id),
      plotName: String(row.plot_name),
      cultivationMode: String(row.cultivation_mode),
      cropTypeId: String(row.crop_type_id),
      cropNameMr: String(row.crop_name_mr),
      cropNameEn: String(row.crop_name_en),
      cropSeasonId: String(row.crop_season_id),
      seasonNameMr: String(row.season_name_mr),
      seasonNameEn: String(row.season_name_en),
      cropNameCustom: row.crop_name_custom ? String(row.crop_name_custom) : null,
      sowingDate: String(row.sowing_date),
      expectedHarvestDate: row.expected_harvest_date ? String(row.expected_harvest_date) : null,
      actualHarvestDate: row.actual_harvest_date ? String(row.actual_harvest_date) : null,
      status: String(row.status),
      notes: row.notes ? String(row.notes) : null,
      createdAt: String(row.created_at),
    }));
  }

  async getCropDetails(groupId: string, cropId: string) {
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: `
        SELECT 
          c.*,
          ct.crop_name_mr, ct.crop_name_en,
          cs.season_name_mr, cs.season_name_en,
          p.plot_name, p.cultivation_mode, p.area_value as plot_area_value, p.area_unit as plot_area_unit,
          f.farm_name, f.village
        FROM crops c
        JOIN crop_types ct ON ct.id = c.crop_type_id
        JOIN crop_seasons cs ON cs.id = c.crop_season_id
        JOIN cultivation_plots p ON p.id = c.plot_id
        JOIN farms f ON f.id = c.farm_id
        WHERE c.id = ? AND c.group_id = ?
      `,
      args: [cropId, groupId],
    });

    if (result.rows.length === 0) {
      throw new AppError('Crop not found.', 404, 'CROP_NOT_FOUND');
    }

    const row = result.rows[0];

    // Fetch activities associated with this crop
    const activitiesResult = await client.execute({
      sql: `
        SELECT a.*, at.name_mr as activity_name_mr, at.name_en as activity_name_en
        FROM activities a
        JOIN activity_types at ON at.id = a.activity_type_id
        WHERE a.crop_id = ? AND a.group_id = ?
        ORDER BY a.created_at DESC
      `,
      args: [cropId, groupId],
    });

    const activities = activitiesResult.rows.map(a => ({
      id: String(a.id),
      activityNameMr: String(a.activity_name_mr),
      activityNameEn: String(a.activity_name_en),
      customActivityName: a.custom_activity_name ? String(a.custom_activity_name) : null,
      status: String(a.status),
      createdAt: String(a.created_at),
    }));

    return {
      id: String(row.id),
      groupId: String(row.group_id),
      farmId: String(row.farm_id),
      farmName: String(row.farm_name),
      village: String(row.village),
      plotId: String(row.plot_id),
      plotName: String(row.plot_name),
      cultivationMode: String(row.cultivation_mode),
      cropTypeId: String(row.crop_type_id),
      cropNameMr: String(row.crop_name_mr),
      cropNameEn: String(row.crop_name_en),
      cropSeasonId: String(row.crop_season_id),
      seasonNameMr: String(row.season_name_mr),
      seasonNameEn: String(row.season_name_en),
      cropNameCustom: row.crop_name_custom ? String(row.crop_name_custom) : null,
      sowingDate: String(row.sowing_date),
      expectedHarvestDate: row.expected_harvest_date ? String(row.expected_harvest_date) : null,
      actualHarvestDate: row.actual_harvest_date ? String(row.actual_harvest_date) : null,
      status: String(row.status),
      notes: row.notes ? String(row.notes) : null,
      activities,
      createdAt: String(row.created_at),
    };
  }

  async updateCrop(
    groupId: string,
    cropId: string,
    userId: string,
    data: {
      cropNameCustom?: string | null;
      sowingDate?: string;
      expectedHarvestDate?: string | null;
      actualHarvestDate?: string | null;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    const existingResult = await client.execute({
      sql: 'SELECT * FROM crops WHERE id = ? AND group_id = ?',
      args: [cropId, groupId],
    });

    if (existingResult.rows.length === 0) {
      throw new AppError('Crop not found.', 404, 'CROP_NOT_FOUND');
    }

    const existing = existingResult.rows[0];
    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          UPDATE crops
          SET crop_name_custom = ?, sowing_date = ?, expected_harvest_date = ?,
              actual_harvest_date = ?, notes = ?, updated_at = ?
          WHERE id = ? AND group_id = ?
        `,
        args: [
          data.cropNameCustom !== undefined ? data.cropNameCustom?.trim() || null : existing.crop_name_custom,
          data.sowingDate ?? existing.sowing_date,
          data.expectedHarvestDate !== undefined ? data.expectedHarvestDate : existing.expected_harvest_date,
          data.actualHarvestDate !== undefined ? data.actualHarvestDate : existing.actual_harvest_date,
          data.notes !== undefined ? data.notes?.trim() || null : existing.notes,
          now,
          cropId,
          groupId,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
          VALUES (?, ?, 'CROP_UPDATED', 'crop', ?, ?, ?, ?)
        `,
        args: [crypto.randomUUID(), userId, cropId, ip || null, userAgent || null, now],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    return this.getCropDetails(groupId, cropId);
  }

  async changeCropStatus(
    groupId: string,
    cropId: string,
    userId: string,
    status: 'planned' | 'active' | 'harvested' | 'cancelled',
    actualHarvestDate?: string | null,
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    const check = await client.execute({
      sql: 'SELECT id, status FROM crops WHERE id = ? AND group_id = ?',
      args: [cropId, groupId],
    });

    if (check.rows.length === 0) {
      throw new AppError('Crop not found.', 404, 'CROP_NOT_FOUND');
    }

    const previousStatus = String(check.rows[0].status);
    const now = new Date().toISOString();
    const harvestDate = status === 'harvested' ? actualHarvestDate || now.split('T')[0] : null;

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          UPDATE crops
          SET status = ?, actual_harvest_date = COALESCE(?, actual_harvest_date), updated_at = ?
          WHERE id = ? AND group_id = ?
        `,
        args: [status, harvestDate, now, cropId, groupId],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'CROP_STATUS_CHANGED', 'crop', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          cropId,
          JSON.stringify({ previousStatus, newStatus: status, actualHarvestDate: harvestDate }),
          ip || null,
          userAgent || null,
          now,
        ],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    logger.info('Crop status updated', { cropId, previousStatus, status });
    return this.getCropDetails(groupId, cropId);
  }

  // ==========================================
  // 4. AGRICULTURAL ACTIVITIES
  // ==========================================

  async getActivityTypes() {
    const client = getDatabaseClient();
    const result = await client.execute('SELECT id, name_mr, name_en FROM activity_types WHERE is_active = 1 ORDER BY id ASC');
    return result.rows.map(r => ({
      id: String(r.id),
      nameMr: String(r.name_mr),
      nameEn: String(r.name_en),
    }));
  }

  async createActivity(
    groupId: string,
    userId: string,
    data: {
      farmId: string;
      plotId?: string | null;
      cropId?: string | null;
      activityTypeId: string;
      customActivityName?: string | null;
      description?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    // Verify farm
    const farmResult = await client.execute({
      sql: 'SELECT id FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [data.farmId, groupId],
    });
    if (farmResult.rows.length === 0) {
      throw new AppError('Farm not found.', 404, 'FARM_NOT_FOUND');
    }

    // Verify plot if provided
    if (data.plotId) {
      const plotResult = await client.execute({
        sql: 'SELECT id FROM cultivation_plots WHERE id = ? AND farm_id = ? AND group_id = ? AND is_active = 1',
        args: [data.plotId, data.farmId, groupId],
      });
      if (plotResult.rows.length === 0) {
        throw new AppError('Plot not found or does not belong to selected farm.', 404, 'PLOT_NOT_FOUND');
      }
    }

    // Verify crop if provided
    if (data.cropId) {
      const cropResult = await client.execute({
        sql: 'SELECT id, plot_id FROM crops WHERE id = ? AND farm_id = ? AND group_id = ?',
        args: [data.cropId, data.farmId, groupId],
      });
      if (cropResult.rows.length === 0) {
        throw new AppError('Crop not found or does not belong to selected farm.', 404, 'CROP_NOT_FOUND');
      }
      if (data.plotId && String(cropResult.rows[0].plot_id) !== data.plotId) {
        throw new AppError('Selected crop does not belong to the selected plot.', 400, 'CROP_PLOT_MISMATCH');
      }
    }

    const activityId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          INSERT INTO activities (
            id, group_id, farm_id, plot_id, crop_id, activity_type_id,
            custom_activity_name, description, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `,
        args: [
          activityId,
          groupId,
          data.farmId,
          data.plotId || null,
          data.cropId || null,
          data.activityTypeId,
          data.customActivityName?.trim() || null,
          data.description?.trim() || null,
          now,
          now,
        ],
      });

      // Append initial event record
      await txn.execute({
        sql: `
          INSERT INTO activity_events (id, activity_id, group_id, actor_id, event_type, event_at, notes)
          VALUES (?, ?, ?, ?, 'created', ?, ?)
        `,
        args: [eventId, activityId, groupId, userId, now, data.description?.trim() || null],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'ACTIVITY_CREATED', 'activity', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          activityId,
          JSON.stringify({ farmId: data.farmId, activityTypeId: data.activityTypeId }),
          ip || null,
          userAgent || null,
          now,
        ],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    logger.info('Activity created', { activityId, farmId: data.farmId, groupId });
    return this.getActivityDetails(groupId, activityId);
  }

  async listActivities(
    groupId: string,
    filters: { farmId?: string; cropId?: string; status?: string }
  ) {
    const client = getDatabaseClient();

    let sql = `
      SELECT 
        a.*,
        at.name_mr as activity_name_mr, at.name_en as activity_name_en,
        f.farm_name, f.village,
        p.plot_name,
        ct.crop_name_mr, ct.crop_name_en,
        c.crop_name_custom,
        u.phone_number as started_by_phone
      FROM activities a
      JOIN activity_types at ON at.id = a.activity_type_id
      JOIN farms f ON f.id = a.farm_id
      LEFT JOIN cultivation_plots p ON p.id = a.plot_id
      LEFT JOIN crops c ON c.id = a.crop_id
      LEFT JOIN crop_types ct ON ct.id = c.crop_type_id
      LEFT JOIN users u ON u.id = a.started_by
      WHERE a.group_id = ?
    `;
    const args: InValue[] = [groupId];

    if (filters.farmId) {
      sql += ' AND a.farm_id = ?';
      args.push(filters.farmId);
    }
    if (filters.cropId) {
      sql += ' AND a.crop_id = ?';
      args.push(filters.cropId);
    }
    if (filters.status) {
      sql += ' AND a.status = ?';
      args.push(filters.status);
    }

    sql += ' ORDER BY a.updated_at DESC, a.created_at DESC';

    const result = await client.execute({ sql, args });

    return result.rows.map(row => ({
      id: String(row.id),
      groupId: String(row.group_id),
      farmId: String(row.farm_id),
      farmName: String(row.farm_name),
      village: String(row.village),
      plotId: row.plot_id ? String(row.plot_id) : null,
      plotName: row.plot_name ? String(row.plot_name) : null,
      cropId: row.crop_id ? String(row.crop_id) : null,
      cropNameMr: row.crop_name_mr ? String(row.crop_name_mr) : null,
      cropNameEn: row.crop_name_en ? String(row.crop_name_en) : null,
      cropNameCustom: row.crop_name_custom ? String(row.crop_name_custom) : null,
      activityTypeId: String(row.activity_type_id),
      activityNameMr: String(row.activity_name_mr),
      activityNameEn: String(row.activity_name_en),
      customActivityName: row.custom_activity_name ? String(row.custom_activity_name) : null,
      description: row.description ? String(row.description) : null,
      status: String(row.status),
      startedByPhoneEnding: row.started_by_phone ? String(row.started_by_phone).slice(-4) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  async getActivityDetails(groupId: string, activityId: string) {
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: `
        SELECT 
          a.*,
          at.name_mr as activity_name_mr, at.name_en as activity_name_en,
          f.farm_name, f.village,
          p.plot_name,
          ct.crop_name_mr, ct.crop_name_en,
          c.crop_name_custom,
          u.phone_number as started_by_phone
        FROM activities a
        JOIN activity_types at ON at.id = a.activity_type_id
        JOIN farms f ON f.id = a.farm_id
        LEFT JOIN cultivation_plots p ON p.id = a.plot_id
        LEFT JOIN crops c ON c.id = a.crop_id
        LEFT JOIN crop_types ct ON ct.id = c.crop_type_id
        LEFT JOIN users u ON u.id = a.started_by
        WHERE a.id = ? AND a.group_id = ?
      `,
      args: [activityId, groupId],
    });

    if (result.rows.length === 0) {
      throw new AppError('Activity not found.', 404, 'ACTIVITY_NOT_FOUND');
    }

    const row = result.rows[0];

    // Fetch append-only event history
    const eventsResult = await client.execute({
      sql: `
        SELECT ae.*, u.phone_number as actor_phone
        FROM activity_events ae
        JOIN users u ON u.id = ae.actor_id
        WHERE ae.activity_id = ? AND ae.group_id = ?
        ORDER BY ae.event_at ASC
      `,
      args: [activityId, groupId],
    });

    const events = eventsResult.rows.map(e => ({
      id: String(e.id),
      actorId: String(e.actor_id),
      actorPhoneEnding: String(e.actor_phone).slice(-4),
      eventType: String(e.event_type),
      eventAt: String(e.event_at),
      notes: e.notes ? String(e.notes) : null,
    }));

    return {
      id: String(row.id),
      groupId: String(row.group_id),
      farmId: String(row.farm_id),
      farmName: String(row.farm_name),
      village: String(row.village),
      plotId: row.plot_id ? String(row.plot_id) : null,
      plotName: row.plot_name ? String(row.plot_name) : null,
      cropId: row.crop_id ? String(row.crop_id) : null,
      cropNameMr: row.crop_name_mr ? String(row.crop_name_mr) : null,
      cropNameEn: row.crop_name_en ? String(row.crop_name_en) : null,
      cropNameCustom: row.crop_name_custom ? String(row.crop_name_custom) : null,
      activityTypeId: String(row.activity_type_id),
      activityNameMr: String(row.activity_name_mr),
      activityNameEn: String(row.activity_name_en),
      customActivityName: row.custom_activity_name ? String(row.custom_activity_name) : null,
      description: row.description ? String(row.description) : null,
      status: String(row.status),
      startedByPhoneEnding: row.started_by_phone ? String(row.started_by_phone).slice(-4) : null,
      events,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async transitionActivity(
    groupId: string,
    activityId: string,
    userId: string,
    transition: 'start' | 'pause' | 'resume' | 'complete',
    notes?: string | null
  ) {
    const client = getDatabaseClient();

    const activityResult = await client.execute({
      sql: 'SELECT id, status, started_by FROM activities WHERE id = ? AND group_id = ?',
      args: [activityId, groupId],
    });

    if (activityResult.rows.length === 0) {
      throw new AppError('Activity not found.', 404, 'ACTIVITY_NOT_FOUND');
    }

    const current = activityResult.rows[0];
    const currentStatus = String(current.status);

    // Validate state transitions (SRS approved lifecycle: pending -> in_progress <-> paused -> completed)
    let nextStatus: string;
    if (transition === 'start') {
      if (currentStatus !== 'pending') {
        throw new AppError(`Cannot start activity that is in '${currentStatus}' status.`, 400, 'INVALID_TRANSITION');
      }
      nextStatus = 'in_progress';
    } else if (transition === 'pause') {
      if (currentStatus !== 'in_progress') {
        throw new AppError(`Cannot pause activity that is not 'in_progress'.`, 400, 'INVALID_TRANSITION');
      }
      nextStatus = 'paused';
    } else if (transition === 'resume') {
      if (currentStatus !== 'paused') {
        throw new AppError(`Cannot resume activity that is not 'paused'.`, 400, 'INVALID_TRANSITION');
      }
      nextStatus = 'in_progress';
    } else if (transition === 'complete') {
      if (currentStatus !== 'in_progress' && currentStatus !== 'pending') {
        throw new AppError(`Cannot complete activity that is in '${currentStatus}' status.`, 400, 'INVALID_TRANSITION');
      }
      nextStatus = 'completed';
    } else {
      throw new AppError('Invalid transition requested.', 400, 'INVALID_TRANSITION');
    }

    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const startedBy = transition === 'start' ? userId : current.started_by;

    const eventTypeMap: Record<string, string> = {
      start: 'started',
      pause: 'paused',
      resume: 'resumed',
      complete: 'completed',
    };
    const eventType = eventTypeMap[transition] || transition;

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: 'UPDATE activities SET status = ?, started_by = ?, updated_at = ? WHERE id = ? AND group_id = ?',
        args: [nextStatus, startedBy ? String(startedBy) : null, now, activityId, groupId],
      });

      // Append event to activity_events
      await txn.execute({
        sql: `
          INSERT INTO activity_events (id, activity_id, group_id, actor_id, event_type, event_at, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [eventId, activityId, groupId, userId, eventType, now, notes?.trim() || null],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    // Phase 4: Activity Reminder Lifecycle Hooks
    try {
      if (transition === 'start') {
        await this.notificationService.scheduleActivityReminders(activityId, groupId, userId, now);
      } else if (transition === 'pause') {
        await this.notificationService.pauseActivityReminders(activityId);
      } else if (transition === 'resume') {
        await this.notificationService.resumeActivityReminders(activityId, now);
      } else if (transition === 'complete') {
        await this.notificationService.cancelActivityReminders(activityId);
      }
    } catch (reminderErr) {
      logger.error('Failed to update activity reminders', { activityId, transition, reminderErr });
    }

    logger.info('Activity transitioned', { activityId, from: currentStatus, to: nextStatus, transition });
    return this.getActivityDetails(groupId, activityId);
  }
}
