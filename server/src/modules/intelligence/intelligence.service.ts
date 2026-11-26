import type { InValue } from '@libsql/client';
import { getDatabaseClient } from '../../database/client.js';
import { FinanceService } from '../finance/finance.service.js';
import { calculateAreaBreakdown } from '../../utils/area.js';

export interface DashboardFilters {
  farmId?: string;
  cropId?: string;
  startDate?: string;
  endDate?: string;
}

export class IntelligenceService {
  private financeService = new FinanceService();

  // ==========================================
  // 1. DASHBOARD OVERVIEW & INTELLIGENCE
  // ==========================================

  async getDashboard(groupId: string, filters?: DashboardFilters) {
    const client = getDatabaseClient();

    // 1. Farms metrics
    const farmsRes = await client.execute({
      sql: `
        SELECT 
          f.id, f.farm_name as farmName, f.village, f.taluka, f.district,
          f.area_sqm as areaSqm, f.area_unit as areaUnit, f.area_value as areaValue,
          (SELECT COUNT(*) FROM crops c WHERE c.farm_id = f.id AND c.status = 'active') as activeCropCount,
          (SELECT COUNT(*) FROM cultivation_plots cp WHERE cp.farm_id = f.id AND cp.is_active = 1) as plotCount
        FROM farms f
        WHERE f.group_id = ? AND f.is_active = 1
        ORDER BY f.created_at ASC
      `,
      args: [groupId],
    });

    const totalFarms = farmsRes.rows.length;
    let totalFarmAreaSqm = 0;
    const farmsList = farmsRes.rows.map((r) => {
      const areaSqm = Number(r.areaSqm);
      totalFarmAreaSqm += areaSqm;
      return {
        id: String(r.id),
        farmName: String(r.farmName),
        village: String(r.village),
        taluka: String(r.taluka),
        district: String(r.district),
        areaValue: Number(r.areaValue),
        areaUnit: String(r.areaUnit),
        areaSqm,
        activeCropCount: Number(r.activeCropCount),
        plotCount: Number(r.plotCount),
      };
    });

    // 2. Plots & Cultivated Area
    const plotsRes = await client.execute({
      sql: `
        SELECT COALESCE(SUM(area_sqm), 0) as cultivatedAreaSqm
        FROM cultivation_plots
        WHERE group_id = ? AND is_active = 1
      `,
      args: [groupId],
    });
    const cultivatedAreaSqm = Number(plotsRes.rows[0].cultivatedAreaSqm);

    // 3. Crops status counts & list
    const cropCountsRes = await client.execute({
      sql: `
        SELECT 
          COUNT(CASE WHEN status = 'active' THEN 1 END) as activeCrops,
          COUNT(CASE WHEN status = 'planned' THEN 1 END) as plannedCrops,
          COUNT(CASE WHEN status = 'harvested' THEN 1 END) as harvestedCrops
        FROM crops
        WHERE group_id = ? AND status != 'cancelled'
      `,
      args: [groupId],
    });
    const activeCropsCount = Number(cropCountsRes.rows[0].activeCrops);
    const plannedCropsCount = Number(cropCountsRes.rows[0].plannedCrops);
    const harvestedCropsCount = Number(cropCountsRes.rows[0].harvestedCrops);

    // Active Crops detail list
    let cropsSql = `
      SELECT 
        c.id, c.farm_id as farmId, f.farm_name as farmName,
        c.plot_id as plotId, cp.plot_name as plotName,
        ct.crop_name_mr as cropNameMr, ct.crop_name_en as cropNameEn,
        cs.season_name_mr as seasonNameMr, cs.season_name_en as seasonNameEn,
        c.crop_name_custom as variety, c.sowing_date as sowingDate,
        c.expected_harvest_date as expectedHarvestDate, c.status
      FROM crops c
      JOIN farms f ON f.id = c.farm_id
      JOIN cultivation_plots cp ON cp.id = c.plot_id
      JOIN crop_types ct ON ct.id = c.crop_type_id
      JOIN crop_seasons cs ON cs.id = c.crop_season_id
      WHERE c.group_id = ? AND c.status = 'active'
    `;
    const cropsArgs: InValue[] = [groupId];
    if (filters?.farmId) {
      cropsSql += ' AND c.farm_id = ?';
      cropsArgs.push(filters.farmId);
    }
    cropsSql += ' ORDER BY c.sowing_date DESC LIMIT 10';
    const cropsListRes = await client.execute({ sql: cropsSql, args: cropsArgs });

    const activeCrops = cropsListRes.rows.map((r) => ({
      id: String(r.id),
      farmId: String(r.farmId),
      farmName: String(r.farmName),
      plotId: String(r.plotId),
      plotName: String(r.plotName),
      cropNameMr: String(r.cropNameMr),
      cropNameEn: String(r.cropNameEn),
      seasonNameMr: String(r.seasonNameMr),
      seasonNameEn: String(r.seasonNameEn),
      variety: r.variety ? String(r.variety) : null,
      sowingDate: String(r.sowingDate),
      expectedHarvestDate: r.expectedHarvestDate ? String(r.expectedHarvestDate) : null,
      status: String(r.status),
    }));

    // 4. Activities metrics & Recent Timeline
    const activitiesCountRes = await client.execute({
      sql: `
        SELECT 
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as inProgressCount,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingCount,
          COUNT(CASE WHEN status = 'paused' THEN 1 END) as pausedCount,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedCount
        FROM activities
        WHERE group_id = ?
      `,
      args: [groupId],
    });
    const activityCounts = {
      inProgress: Number(activitiesCountRes.rows[0].inProgressCount),
      pending: Number(activitiesCountRes.rows[0].pendingCount),
      paused: Number(activitiesCountRes.rows[0].pausedCount),
      completed: Number(activitiesCountRes.rows[0].completedCount),
    };

    // Recent 5 activities
    let recentActsSql = `
      SELECT 
        a.id, a.farm_id as farmId, f.farm_name as farmName,
        a.plot_id as plotId, cp.plot_name as plotName,
        a.crop_id as cropId, ct.crop_name_mr as cropNameMr,
        at.name_mr as activityTypeMr, at.name_en as activityTypeEn,
        a.custom_activity_name as customName, a.status, a.created_at as createdAt,
        u.phone_number as createdByPhone
      FROM activities a
      JOIN farms f ON f.id = a.farm_id
      JOIN cultivation_plots cp ON cp.id = a.plot_id
      LEFT JOIN crops c ON c.id = a.crop_id
      LEFT JOIN crop_types ct ON ct.id = c.crop_type_id
      JOIN activity_types at ON at.id = a.activity_type_id
      LEFT JOIN users u ON u.id = a.started_by
      WHERE a.group_id = ?
    `;
    const recentActsArgs: InValue[] = [groupId];
    if (filters?.farmId) {
      recentActsSql += ' AND a.farm_id = ?';
      recentActsArgs.push(filters.farmId);
    }
    recentActsSql += ' ORDER BY a.created_at DESC LIMIT 5';
    const recentActsRes = await client.execute({ sql: recentActsSql, args: recentActsArgs });

    const recentActivities = recentActsRes.rows.map((r) => ({
      id: String(r.id),
      farmId: String(r.farmId),
      farmName: String(r.farmName),
      plotId: String(r.plotId),
      plotName: String(r.plotName),
      cropId: r.cropId ? String(r.cropId) : null,
      cropNameMr: r.cropNameMr ? String(r.cropNameMr) : null,
      activityTypeMr: String(r.activityTypeMr),
      activityTypeEn: String(r.activityTypeEn),
      customName: r.customName ? String(r.customName) : null,
      status: String(r.status),
      createdAt: String(r.createdAt),
      createdByPhone: String(r.createdByPhone),
    }));

    // 5. Financial KPIs (Uses verified FinanceService)
    const financialSummary = await this.financeService.getFinancialSummary(groupId, {
      farmId: filters?.farmId,
      cropId: filters?.cropId,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });

    // 6. Area Breakdowns
    const totalAreaBreakdown = calculateAreaBreakdown(totalFarmAreaSqm);
    const cultivatedAreaBreakdown = calculateAreaBreakdown(cultivatedAreaSqm);

    return {
      farms: {
        total: totalFarms,
        totalAreaSqm: totalFarmAreaSqm,
        totalAreaBreakdown,
        cultivatedAreaSqm,
        cultivatedAreaBreakdown,
        list: farmsList,
      },
      crops: {
        activeCount: activeCropsCount,
        plannedCount: plannedCropsCount,
        harvestedCount: harvestedCropsCount,
        list: activeCrops,
      },
      activities: {
        counts: activityCounts,
        recent: recentActivities,
      },
      financial: financialSummary,
    };
  }

  // ==========================================
  // 2. DETAILED REPORTS & ANALYTICS
  // ==========================================

  async getReports(
    groupId: string,
    options: {
      type: 'farms' | 'crops' | 'financial' | 'categories' | 'monthly';
      farmId?: string;
      cropId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const client = getDatabaseClient();

    if (options.type === 'farms') {
      const sql = `
        SELECT 
          f.id, f.farm_name as farmName, f.village, f.taluka, f.district,
          f.survey_number as surveyNumber, f.area_sqm as areaSqm,
          (SELECT COUNT(*) FROM crops c WHERE c.farm_id = f.id AND c.status = 'active') as activeCrops,
          COALESCE((SELECT SUM(e.amount_paise) FROM expenses e WHERE e.farm_id = f.id AND e.is_active = 1), 0) as totalExpensePaise,
          COALESCE((SELECT SUM(s.total_amount_paise) FROM sales s WHERE s.farm_id = f.id AND s.is_active = 1), 0) as totalSalesPaise
        FROM farms f
        WHERE f.group_id = ? AND f.is_active = 1
        ORDER BY f.created_at ASC
      `;
      const res = await client.execute({ sql, args: [groupId] });
      return res.rows.map((r) => {
        const areaSqm = Number(r.areaSqm);
        const totalExpensePaise = Number(r.totalExpensePaise);
        const totalSalesPaise = Number(r.totalSalesPaise);
        return {
          id: String(r.id),
          farmName: String(r.farmName),
          village: String(r.village),
          taluka: String(r.taluka),
          district: String(r.district),
          surveyNumber: r.surveyNumber ? String(r.surveyNumber) : null,
          areaBreakdown: calculateAreaBreakdown(areaSqm),
          activeCrops: Number(r.activeCrops),
          totalExpensePaise,
          totalSalesPaise,
          netProfitPaise: totalSalesPaise - totalExpensePaise,
        };
      });
    }

    if (options.type === 'crops') {
      let sql = `
        SELECT 
          c.id, c.farm_id as farmId, f.farm_name as farmName,
          c.plot_id as plotId, cp.plot_name as plotName, cp.cultivation_mode as cultivationMode,
          ct.crop_name_mr as cropNameMr, ct.crop_name_en as cropNameEn,
          cs.season_name_mr as seasonNameMr, cs.season_name_en as seasonNameEn,
          c.crop_name_custom as variety, c.sowing_date as sowingDate,
          c.status,
          COALESCE((SELECT SUM(ea.amount_paise) FROM expense_allocations ea WHERE ea.crop_id = c.id), 0) as allocatedExpensePaise,
          COALESCE((SELECT SUM(s.total_amount_paise) FROM sales s WHERE s.crop_id = c.id AND s.is_active = 1), 0) as salesRevenuePaise,
          COALESCE((SELECT SUM(h.quantity) FROM harvests h WHERE h.crop_id = c.id AND h.is_active = 1), 0) as totalHarvestQty,
          COALESCE((SELECT SUM(s.quantity) FROM sales s WHERE s.crop_id = c.id AND s.is_active = 1), 0) as totalSoldQty
        FROM crops c
        JOIN farms f ON f.id = c.farm_id
        JOIN cultivation_plots cp ON cp.id = c.plot_id
        JOIN crop_types ct ON ct.id = c.crop_type_id
        JOIN crop_seasons cs ON cs.id = c.crop_season_id
        WHERE c.group_id = ? AND c.status != 'cancelled'
      `;
      const args: InValue[] = [groupId];
      if (options.farmId) {
        sql += ' AND c.farm_id = ?';
        args.push(options.farmId);
      }
      sql += ' ORDER BY c.sowing_date DESC';
      const res = await client.execute({ sql, args });

      return res.rows.map((r) => {
        const allocatedExpensePaise = Number(r.allocatedExpensePaise);
        const salesRevenuePaise = Number(r.salesRevenuePaise);
        const totalHarvestQty = Number(r.totalHarvestQty);
        const totalSoldQty = Number(r.totalSoldQty);
        return {
          id: String(r.id),
          farmName: String(r.farmName),
          plotName: String(r.plotName),
          cultivationMode: String(r.cultivationMode),
          cropNameMr: String(r.cropNameMr),
          cropNameEn: String(r.cropNameEn),
          seasonNameMr: String(r.seasonNameMr),
          variety: r.variety ? String(r.variety) : null,
          sowingDate: String(r.sowingDate),
          status: String(r.status),
          allocatedExpensePaise,
          salesRevenuePaise,
          netProfitPaise: salesRevenuePaise - allocatedExpensePaise,
          totalHarvestQty,
          totalSoldQty,
          remainingQty: Math.max(0, totalHarvestQty - totalSoldQty),
        };
      });
    }

    if (options.type === 'monthly') {
      // Monthly time-series for the past 12 months
      const monthsRes = await client.execute({
        sql: `
          WITH RECURSIVE months(m) AS (
            SELECT date('now', 'start of month', '-11 months')
            UNION ALL
            SELECT date(m, '+1 month') FROM months WHERE m < date('now', 'start of month')
          )
          SELECT 
            strftime('%Y-%m', m) as monthYear,
            COALESCE((
              SELECT SUM(e.amount_paise) 
              FROM expenses e 
              WHERE e.group_id = ? AND e.is_active = 1 AND strftime('%Y-%m', e.expense_date) = strftime('%Y-%m', m)
            ), 0) as expensePaise,
            COALESCE((
              SELECT SUM(s.total_amount_paise) 
              FROM sales s 
              WHERE s.group_id = ? AND s.is_active = 1 AND strftime('%Y-%m', s.sale_date) = strftime('%Y-%m', m)
            ), 0) as salesPaise
          FROM months
          ORDER BY monthYear ASC
        `,
        args: [groupId, groupId],
      });

      return monthsRes.rows.map((r) => {
        const expensePaise = Number(r.expensePaise);
        const salesPaise = Number(r.salesPaise);
        return {
          monthYear: String(r.monthYear),
          expensePaise,
          salesPaise,
          profitPaise: salesPaise - expensePaise,
        };
      });
    }

    // Default: summary financial & categories
    return this.financeService.getFinancialSummary(groupId, {
      farmId: options.farmId,
      cropId: options.cropId,
      startDate: options.startDate,
      endDate: options.endDate,
    });
  }

  // ==========================================
  // 3. UTF-8 BOM CSV EXPORT (MARATHI-SAFE)
  // ==========================================

  async exportCsv(
    groupId: string,
    dataset: 'expenses' | 'sales' | 'harvests' | 'farms',
    filters?: { farmId?: string; startDate?: string; endDate?: string }
  ): Promise<{ filename: string; content: string }> {
    const client = getDatabaseClient();
    const sanitize = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      let str = String(val).replace(/"/g, '""');
      // Prevent spreadsheet formula injection
      if (/^[=+@-]$/.test(str.charAt(0))) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    let filename = `shetibook_${dataset}_${new Date().toISOString().slice(0, 10)}.csv`;
    let headers: string[] = [];
    const rows: string[][] = [];

    if (dataset === 'expenses') {
      headers = ['तारीख (Date)', 'शेत (Farm)', 'प्रवर्ग (Category)', 'रक्कम रुपये (Amount INR)', 'तपशील (Description)'];
      let sql = `
        SELECT e.expense_date, f.farm_name, ec.name_mr, e.amount_paise, e.description
        FROM expenses e
        JOIN farms f ON f.id = e.farm_id
        JOIN expense_categories ec ON ec.id = e.expense_category_id
        WHERE e.group_id = ? AND e.is_active = 1
      `;
      const args: InValue[] = [groupId];
      if (filters?.farmId) {
        sql += ' AND e.farm_id = ?';
        args.push(filters.farmId);
      }
      if (filters?.startDate) {
        sql += ' AND e.expense_date >= ?';
        args.push(filters.startDate);
      }
      if (filters?.endDate) {
        sql += ' AND e.expense_date <= ?';
        args.push(filters.endDate);
      }
      sql += ' ORDER BY e.expense_date DESC';
      const res = await client.execute({ sql, args });
      for (const r of res.rows) {
        rows.push([
          String(r.expense_date),
          String(r.farm_name),
          String(r.name_mr),
          (Number(r.amount_paise) / 100).toFixed(2),
          r.description ? String(r.description) : '',
        ]);
      }
    } else if (dataset === 'sales') {
      headers = ['तारीख (Date)', 'शेत (Farm)', 'पीक (Crop)', 'प्रमाण (Quantity)', 'एकक (Unit)', 'दर रु. (Rate INR)', 'एकूण रु. (Total INR)', 'खरेदीदार (Buyer)'];
      let sql = `
        SELECT s.sale_date, f.farm_name, ct.crop_name_mr, s.quantity, s.unit, s.rate_paise, s.total_amount_paise, s.buyer_name
        FROM sales s
        JOIN farms f ON f.id = s.farm_id
        JOIN crops c ON c.id = s.crop_id
        JOIN crop_types ct ON ct.id = c.crop_type_id
        WHERE s.group_id = ? AND s.is_active = 1
      `;
      const args: InValue[] = [groupId];
      if (filters?.farmId) {
        sql += ' AND s.farm_id = ?';
        args.push(filters.farmId);
      }
      if (filters?.startDate) {
        sql += ' AND s.sale_date >= ?';
        args.push(filters.startDate);
      }
      if (filters?.endDate) {
        sql += ' AND s.sale_date <= ?';
        args.push(filters.endDate);
      }
      sql += ' ORDER BY s.sale_date DESC';
      const res = await client.execute({ sql, args });
      for (const r of res.rows) {
        rows.push([
          String(r.sale_date),
          String(r.farm_name),
          String(r.crop_name_mr),
          String(r.quantity),
          String(r.unit),
          (Number(r.rate_paise) / 100).toFixed(2),
          (Number(r.total_amount_paise) / 100).toFixed(2),
          r.buyer_name ? String(r.buyer_name) : '',
        ]);
      }
    } else if (dataset === 'harvests') {
      headers = ['तारीख (Date)', 'शेत (Farm)', 'पीक (Crop)', 'काढणी प्रमाण (Harvested)', 'एकक (Unit)', 'नोंदी (Notes)'];
      const sql = `
        SELECT h.harvest_date, f.farm_name, ct.crop_name_mr, h.quantity, h.unit, h.notes
        FROM harvests h
        JOIN farms f ON f.id = h.farm_id
        JOIN crops c ON c.id = h.crop_id
        JOIN crop_types ct ON ct.id = c.crop_type_id
        WHERE h.group_id = ? AND h.is_active = 1
        ORDER BY h.harvest_date DESC
      `;
      const res = await client.execute({ sql, args: [groupId] });
      for (const r of res.rows) {
        rows.push([
          String(r.harvest_date),
          String(r.farm_name),
          String(r.crop_name_mr),
          String(r.quantity),
          String(r.unit),
          r.notes ? String(r.notes) : '',
        ]);
      }
    } else {
      // Farms
      headers = ['शेत नाव (Farm Name)', 'गाव (Village)', 'तालुका (Taluka)', 'जिल्हा (District)', 'गट/सर्व्हे क्र. (Survey No)', 'क्षेत्र एकर/गुंठे (Area)'];
      const sql = `
        SELECT farm_name, village, taluka, district, survey_number, area_sqm
        FROM farms
        WHERE group_id = ? AND is_active = 1
        ORDER BY farm_name ASC
      `;
      const res = await client.execute({ sql, args: [groupId] });
      for (const r of res.rows) {
        const bd = calculateAreaBreakdown(Number(r.area_sqm));
        rows.push([
          String(r.farm_name),
          String(r.village),
          String(r.taluka),
          String(r.district),
          r.survey_number ? String(r.survey_number) : '',
          `${bd.acre} एकर ${bd.guntha} गुंठे`,
        ]);
      }
    }

    // Prepend UTF-8 Byte Order Mark (BOM) \uFEFF for proper Devanagari display in Microsoft Excel
    const csvContent =
      '\uFEFF' +
      headers.map(sanitize).join(',') +
      '\r\n' +
      rows.map((row) => row.map(sanitize).join(',')).join('\r\n');

    return { filename, content: csvContent };
  }
}
