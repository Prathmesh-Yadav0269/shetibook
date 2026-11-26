import crypto from 'crypto';
import type { InValue } from '@libsql/client';
import { getDatabaseClient } from '../../database/client.js';
import { AppError } from '../../middleware/error.middleware.js';
import { logger } from '../../utils/logger.js';
import {
  derivePaymentStatus,
  toKg,
  fromKg,
  HarvestUnit,
  PaymentMethod,
} from '../../utils/finance.js';

export interface ExpenseAllocationInput {
  cropId: string;
  amountPaise: number;
}

export class FinanceService {
  // ==========================================
  // 1. EXPENSE CATEGORIES
  // ==========================================

  async listCategories(groupId: string) {
    const client = getDatabaseClient();
    const result = await client.execute({
      sql: `
        SELECT id, group_id as groupId, name_mr as nameMr, name_en as nameEn,
               is_system as isSystem, is_active as isActive, created_at as createdAt
        FROM expense_categories
        WHERE (is_system = 1 OR group_id = ?) AND is_active = 1
        ORDER BY is_system DESC, name_mr ASC
      `,
      args: [groupId],
    });

    return result.rows.map((r) => ({
      id: String(r.id),
      groupId: r.groupId ? String(r.groupId) : null,
      nameMr: String(r.nameMr),
      nameEn: String(r.nameEn),
      isSystem: Boolean(r.isSystem),
      isActive: Boolean(r.isActive),
      createdAt: String(r.createdAt),
    }));
  }

  async createCategory(
    groupId: string,
    userId: string,
    data: { nameMr: string; nameEn: string },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();
    const categoryId = crypto.randomUUID();
    const now = new Date().toISOString();

    await client.execute({
      sql: `
        INSERT INTO expense_categories (id, group_id, name_mr, name_en, is_system, is_active, created_at)
        VALUES (?, ?, ?, ?, 0, 1, ?)
      `,
      args: [categoryId, groupId, data.nameMr.trim(), data.nameEn.trim(), now],
    });

    await client.execute({
      sql: `
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
        VALUES (?, ?, 'EXPENSE_CATEGORY_CREATED', 'expense_category', ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        userId,
        categoryId,
        JSON.stringify({ nameMr: data.nameMr, nameEn: data.nameEn }),
        ip || null,
        userAgent || null,
        now,
      ],
    });

    logger.info('Expense category created', { categoryId, groupId, userId });

    return {
      id: categoryId,
      groupId,
      nameMr: data.nameMr.trim(),
      nameEn: data.nameEn.trim(),
      isSystem: false,
      isActive: true,
      createdAt: now,
    };
  }

  // ==========================================
  // 2. EXPENSES
  // ==========================================

  async createExpense(
    groupId: string,
    userId: string,
    data: {
      farmId: string;
      expenseCategoryId: string;
      amountPaise: number;
      expenseDate: string;
      description?: string | null;
      allocations?: ExpenseAllocationInput[] | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    // Verify farm
    const farmCheck = await client.execute({
      sql: 'SELECT id FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [data.farmId, groupId],
    });
    if (farmCheck.rows.length === 0) {
      throw new AppError('शेत आढळले नाही किंवा परवाणगी नाही (Farm not found or inaccessible)', 404);
    }

    // Verify category
    const catCheck = await client.execute({
      sql: 'SELECT id FROM expense_categories WHERE id = ? AND (is_system = 1 OR group_id = ?) AND is_active = 1',
      args: [data.expenseCategoryId, groupId],
    });
    if (catCheck.rows.length === 0) {
      throw new AppError('खर्च प्रवर्ग आढळला नाही (Category not found)', 404);
    }

    // Verify allocations if provided
    if (data.allocations && data.allocations.length > 0) {
      const totalAllocated = data.allocations.reduce((sum, item) => sum + item.amountPaise, 0);
      if (totalAllocated > data.amountPaise) {
        throw new AppError('पिकांना वाटप केलेली एकूण रक्कम मूळ खर्चापेक्षा जास्त असू शकत नाही', 400);
      }

      // Check unique crops in allocations
      const cropIds = data.allocations.map((a) => a.cropId);
      if (new Set(cropIds).size !== cropIds.length) {
        throw new AppError('एकाच पिकाची एकापेक्षा जास्त वेळा विभागणी करता येणार नाही (Duplicate crop in allocations)', 400);
      }

      for (const item of data.allocations) {
        const cropCheck = await client.execute({
          sql: "SELECT id FROM crops WHERE id = ? AND group_id = ? AND status != 'cancelled'",
          args: [item.cropId, groupId],
        });
        if (cropCheck.rows.length === 0) {
          throw new AppError(`पीक (${item.cropId}) आढळले नाही`, 404);
        }
      }
    }

    const expenseId = crypto.randomUUID();
    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          INSERT INTO expenses (
            id, group_id, farm_id, expense_category_id, amount_paise,
            expense_date, description, created_by, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `,
        args: [
          expenseId,
          groupId,
          data.farmId,
          data.expenseCategoryId,
          data.amountPaise,
          data.expenseDate,
          data.description?.trim() || null,
          userId,
          now,
          now,
        ],
      });

      if (data.allocations && data.allocations.length > 0) {
        for (const item of data.allocations) {
          await txn.execute({
            sql: `
              INSERT INTO expense_allocations (id, expense_id, crop_id, group_id, amount_paise, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [crypto.randomUUID(), expenseId, item.cropId, groupId, item.amountPaise, now],
          });
        }
      }

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'EXPENSE_CREATED', 'expense', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          expenseId,
          JSON.stringify({
            amountPaise: data.amountPaise,
            farmId: data.farmId,
            expenseCategoryId: data.expenseCategoryId,
            allocationsCount: data.allocations?.length || 0,
          }),
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

    return this.getExpenseDetails(groupId, expenseId);
  }

  async listExpenses(
    groupId: string,
    filters?: {
      farmId?: string;
      cropId?: string;
      categoryId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const client = getDatabaseClient();
    let sql = `
      SELECT 
        e.id, e.group_id as groupId, e.farm_id as farmId, f.farm_name as farmName,
        e.expense_category_id as categoryId, ec.name_mr as categoryNameMr, ec.name_en as categoryNameEn,
        e.amount_paise as amountPaise, e.expense_date as expenseDate, e.description,
        e.created_by as createdBy, u.phone_number as createdByName, e.created_at as createdAt,
        COALESCE((SELECT SUM(p.amount_paise) FROM payments p WHERE p.expense_id = e.id), 0) as paidPaise,
        COALESCE((SELECT SUM(ea.amount_paise) FROM expense_allocations ea WHERE ea.expense_id = e.id), 0) as allocatedPaise
      FROM expenses e
      JOIN farms f ON f.id = e.farm_id
      JOIN expense_categories ec ON ec.id = e.expense_category_id
      JOIN users u ON u.id = e.created_by
      WHERE e.group_id = ? AND e.is_active = 1
    `;
    const args: InValue[] = [groupId];

    if (filters?.farmId) {
      sql += ' AND e.farm_id = ?';
      args.push(filters.farmId);
    }
    if (filters?.categoryId) {
      sql += ' AND e.expense_category_id = ?';
      args.push(filters.categoryId);
    }
    if (filters?.startDate) {
      sql += ' AND e.expense_date >= ?';
      args.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ' AND e.expense_date <= ?';
      args.push(filters.endDate);
    }
    if (filters?.cropId) {
      sql += ' AND EXISTS (SELECT 1 FROM expense_allocations ea WHERE ea.expense_id = e.id AND ea.crop_id = ?)';
      args.push(filters.cropId);
    }

    sql += ' ORDER BY e.expense_date DESC, e.created_at DESC';

    const result = await client.execute({ sql, args });

    return result.rows.map((r) => {
      const amountPaise = Number(r.amountPaise);
      const paidPaise = Number(r.paidPaise);
      const allocatedPaise = Number(r.allocatedPaise);
      const balancePaise = Math.max(0, amountPaise - paidPaise);
      const paymentStatus = derivePaymentStatus(amountPaise, paidPaise);

      return {
        id: String(r.id),
        groupId: String(r.groupId),
        farmId: String(r.farmId),
        farmName: String(r.farmName),
        categoryId: String(r.categoryId),
        categoryNameMr: String(r.categoryNameMr),
        categoryNameEn: String(r.categoryNameEn),
        amountPaise,
        expenseDate: String(r.expenseDate),
        description: r.description ? String(r.description) : null,
        createdBy: String(r.createdBy),
        createdByName: String(r.createdByName),
        createdAt: String(r.createdAt),
        paidPaise,
        balancePaise,
        allocatedPaise,
        unallocatedPaise: Math.max(0, amountPaise - allocatedPaise),
        paymentStatus,
      };
    });
  }

  async getExpenseDetails(groupId: string, expenseId: string) {
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: `
        SELECT 
          e.id, e.group_id as groupId, e.farm_id as farmId, f.farm_name as farmName,
          e.expense_category_id as categoryId, ec.name_mr as categoryNameMr, ec.name_en as categoryNameEn,
          e.amount_paise as amountPaise, e.expense_date as expenseDate, e.description,
          e.created_by as createdBy, u.phone_number as createdByName, e.created_at as createdAt, e.updated_at as updatedAt,
          COALESCE((SELECT SUM(p.amount_paise) FROM payments p WHERE p.expense_id = e.id), 0) as paidPaise
        FROM expenses e
        JOIN farms f ON f.id = e.farm_id
        JOIN expense_categories ec ON ec.id = e.expense_category_id
        JOIN users u ON u.id = e.created_by
        WHERE e.id = ? AND e.group_id = ? AND e.is_active = 1
      `,
      args: [expenseId, groupId],
    });

    if (result.rows.length === 0) {
      throw new AppError('खर्च नोंद आढळली नाही (Expense not found)', 404);
    }

    const row = result.rows[0];
    const amountPaise = Number(row.amountPaise);
    const paidPaise = Number(row.paidPaise);
    const balancePaise = Math.max(0, amountPaise - paidPaise);
    const paymentStatus = derivePaymentStatus(amountPaise, paidPaise);

    // Fetch allocations
    const allocationsResult = await client.execute({
      sql: `
        SELECT 
          ea.id, ea.crop_id as cropId, ea.amount_paise as amountPaise, ea.created_at as createdAt,
          c.crop_name_custom as cropNameCustom, ct.crop_name_mr as cropTypeNameMr, ct.crop_name_en as cropTypeNameEn,
          p.plot_name as plotName
        FROM expense_allocations ea
        JOIN crops c ON c.id = ea.crop_id
        JOIN crop_types ct ON ct.id = c.crop_type_id
        JOIN cultivation_plots p ON p.id = c.plot_id
        WHERE ea.expense_id = ? AND ea.group_id = ?
        ORDER BY ea.created_at ASC
      `,
      args: [expenseId, groupId],
    });

    const allocations = allocationsResult.rows.map((a) => ({
      id: String(a.id),
      cropId: String(a.cropId),
      cropName: String(a.cropNameCustom || a.cropTypeNameMr || a.cropTypeNameEn),
      plotName: String(a.plotName),
      amountPaise: Number(a.amountPaise),
      createdAt: String(a.createdAt),
    }));

    const allocatedPaise = allocations.reduce((sum, item) => sum + item.amountPaise, 0);

    // Fetch payments
    const paymentsResult = await client.execute({
      sql: `
        SELECT 
          p.id, p.amount_paise as amountPaise, p.payment_date as paymentDate,
          p.payment_method as paymentMethod, p.reference_number as referenceNumber,
          p.notes, p.created_at as createdAt, u.phone_number as createdByName
        FROM payments p
        JOIN users u ON u.id = p.created_by
        WHERE p.expense_id = ? AND p.group_id = ?
        ORDER BY p.payment_date DESC, p.created_at DESC
      `,
      args: [expenseId, groupId],
    });

    const payments = paymentsResult.rows.map((p) => ({
      id: String(p.id),
      amountPaise: Number(p.amountPaise),
      paymentDate: String(p.paymentDate),
      paymentMethod: String(p.paymentMethod) as PaymentMethod,
      referenceNumber: p.referenceNumber ? String(p.referenceNumber) : null,
      notes: p.notes ? String(p.notes) : null,
      createdAt: String(p.createdAt),
      createdByName: String(p.createdByName),
    }));

    return {
      id: String(row.id),
      groupId: String(row.groupId),
      farmId: String(row.farmId),
      farmName: String(row.farmName),
      categoryId: String(row.categoryId),
      categoryNameMr: String(row.categoryNameMr),
      categoryNameEn: String(row.categoryNameEn),
      amountPaise,
      expenseDate: String(row.expenseDate),
      description: row.description ? String(row.description) : null,
      createdBy: String(row.createdBy),
      createdByName: String(row.createdByName),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      paidPaise,
      balancePaise,
      allocatedPaise,
      unallocatedPaise: Math.max(0, amountPaise - allocatedPaise),
      paymentStatus,
      allocations,
      payments,
    };
  }

  async updateExpense(
    groupId: string,
    expenseId: string,
    userId: string,
    data: {
      farmId?: string;
      expenseCategoryId?: string;
      amountPaise?: number;
      expenseDate?: string;
      description?: string | null;
      allocations?: ExpenseAllocationInput[] | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();
    const existing = await this.getExpenseDetails(groupId, expenseId);

    const newAmountPaise = data.amountPaise ?? existing.amountPaise;

    // Check if new amount is less than already paid amount
    if (newAmountPaise < existing.paidPaise) {
      throw new AppError('खर्चाची रक्कम आधी केलेल्या पेमेंटपेक्षा कमी असू शकत नाही (Amount cannot be less than paid amount)', 400);
    }

    if (data.farmId && data.farmId !== existing.farmId) {
      const farmCheck = await client.execute({
        sql: 'SELECT id FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
        args: [data.farmId, groupId],
      });
      if (farmCheck.rows.length === 0) {
        throw new AppError('शेत आढळले नाही', 404);
      }
    }

    if (data.expenseCategoryId && data.expenseCategoryId !== existing.categoryId) {
      const catCheck = await client.execute({
        sql: 'SELECT id FROM expense_categories WHERE id = ? AND (is_system = 1 OR group_id = ?) AND is_active = 1',
        args: [data.expenseCategoryId, groupId],
      });
      if (catCheck.rows.length === 0) {
        throw new AppError('खर्च प्रवर्ग आढळला नाही', 404);
      }
    }

    const allocationsToSet = data.allocations !== undefined ? data.allocations : null;

    if (allocationsToSet) {
      const totalAllocated = allocationsToSet.reduce((sum, item) => sum + item.amountPaise, 0);
      if (totalAllocated > newAmountPaise) {
        throw new AppError('पिकांना वाटप केलेली एकूण रक्कम मूळ खर्चापेक्षा जास्त असू शकत नाही', 400);
      }
    } else if (data.amountPaise && existing.allocatedPaise > newAmountPaise) {
      throw new AppError('खर्चाची नवीन रक्कम आधीच केलेल्या पीक वाटपापेक्षा कमी आहे', 400);
    }

    const now = new Date().toISOString();
    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          UPDATE expenses SET
            farm_id = COALESCE(?, farm_id),
            expense_category_id = COALESCE(?, expense_category_id),
            amount_paise = COALESCE(?, amount_paise),
            expense_date = COALESCE(?, expense_date),
            description = COALESCE(?, description),
            updated_at = ?
          WHERE id = ? AND group_id = ?
        `,
        args: [
          data.farmId || null,
          data.expenseCategoryId || null,
          data.amountPaise || null,
          data.expenseDate || null,
          data.description !== undefined ? data.description : null,
          now,
          expenseId,
          groupId,
        ],
      });

      if (allocationsToSet !== null) {
        await txn.execute({
          sql: 'DELETE FROM expense_allocations WHERE expense_id = ? AND group_id = ?',
          args: [expenseId, groupId],
        });

        for (const item of allocationsToSet) {
          await txn.execute({
            sql: `
              INSERT INTO expense_allocations (id, expense_id, crop_id, group_id, amount_paise, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [crypto.randomUUID(), expenseId, item.cropId, groupId, item.amountPaise, now],
          });
        }
      }

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'EXPENSE_UPDATED', 'expense', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          expenseId,
          JSON.stringify({ updatedFields: Object.keys(data) }),
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

    return this.getExpenseDetails(groupId, expenseId);
  }

  async deleteExpense(groupId: string, expenseId: string, userId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();
    await this.getExpenseDetails(groupId, expenseId);

    const now = new Date().toISOString();
    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: 'UPDATE expenses SET is_active = 0, updated_at = ? WHERE id = ? AND group_id = ?',
        args: [now, expenseId, groupId],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'EXPENSE_DELETED', 'expense', ?, NULL, ?, ?, ?)
        `,
        args: [crypto.randomUUID(), userId, expenseId, ip || null, userAgent || null, now],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    return { success: true };
  }

  // ==========================================
  // 3. HARVESTS
  // ==========================================

  async createHarvest(
    groupId: string,
    userId: string,
    data: {
      farmId: string;
      cropId: string;
      harvestDate: string;
      quantity: number;
      unit: HarvestUnit;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    // Verify farm
    const farmCheck = await client.execute({
      sql: 'SELECT id FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [data.farmId, groupId],
    });
    if (farmCheck.rows.length === 0) {
      throw new AppError('शेत आढळले नाही', 404);
    }

    // Verify crop
    const cropCheck = await client.execute({
      sql: "SELECT id FROM crops WHERE id = ? AND group_id = ? AND farm_id = ? AND status != 'cancelled'",
      args: [data.cropId, groupId, data.farmId],
    });
    if (cropCheck.rows.length === 0) {
      throw new AppError('पीक आढळले नाही किंवा शेताशी जोडलेले नाही', 404);
    }

    const harvestId = crypto.randomUUID();
    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          INSERT INTO harvests (
            id, group_id, farm_id, crop_id, harvest_date, quantity,
            unit, notes, created_by, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `,
        args: [
          harvestId,
          groupId,
          data.farmId,
          data.cropId,
          data.harvestDate,
          data.quantity,
          data.unit,
          data.notes?.trim() || null,
          userId,
          now,
          now,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'HARVEST_CREATED', 'harvest', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          harvestId,
          JSON.stringify({ quantity: data.quantity, unit: data.unit, cropId: data.cropId }),
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

    return this.getHarvestDetails(groupId, harvestId);
  }

  async listHarvests(
    groupId: string,
    filters?: {
      farmId?: string;
      cropId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const client = getDatabaseClient();
    let sql = `
      SELECT 
        h.id, h.group_id as groupId, h.farm_id as farmId, f.farm_name as farmName,
        h.crop_id as cropId, c.crop_name_custom as cropNameCustom,
        ct.crop_name_mr as cropTypeNameMr, ct.crop_name_en as cropTypeNameEn,
        p.plot_name as plotName,
        h.harvest_date as harvestDate, h.quantity, h.unit, h.notes,
        h.created_by as createdBy, u.phone_number as createdByName, h.created_at as createdAt
      FROM harvests h
      JOIN farms f ON f.id = h.farm_id
      JOIN crops c ON c.id = h.crop_id
      JOIN crop_types ct ON ct.id = c.crop_type_id
      JOIN cultivation_plots p ON p.id = c.plot_id
      JOIN users u ON u.id = h.created_by
      WHERE h.group_id = ? AND h.is_active = 1
    `;
    const args: InValue[] = [groupId];

    if (filters?.farmId) {
      sql += ' AND h.farm_id = ?';
      args.push(filters.farmId);
    }
    if (filters?.cropId) {
      sql += ' AND h.crop_id = ?';
      args.push(filters.cropId);
    }
    if (filters?.startDate) {
      sql += ' AND h.harvest_date >= ?';
      args.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ' AND h.harvest_date <= ?';
      args.push(filters.endDate);
    }

    sql += ' ORDER BY h.harvest_date DESC, h.created_at DESC';

    const result = await client.execute({ sql, args });

    // For each harvest, calculate sold quantity converted to harvest unit
    const harvests = [];
    for (const r of result.rows) {
      const harvestId = String(r.id);
      const harvestUnit = String(r.unit) as HarvestUnit;
      const totalQty = Number(r.quantity);

      const salesResult = await client.execute({
        sql: 'SELECT quantity, unit FROM sales WHERE harvest_id = ? AND group_id = ? AND is_active = 1',
        args: [harvestId, groupId],
      });

      let soldKg = 0;
      for (const s of salesResult.rows) {
        soldKg += toKg(Number(s.quantity), String(s.unit) as HarvestUnit);
      }

      const totalKg = toKg(totalQty, harvestUnit);
      const remainingKg = Math.max(0, totalKg - soldKg);
      const soldInHarvestUnit = fromKg(soldKg, harvestUnit);
      const remainingInHarvestUnit = fromKg(remainingKg, harvestUnit);

      harvests.push({
        id: harvestId,
        groupId: String(r.groupId),
        farmId: String(r.farmId),
        farmName: String(r.farmName),
        cropId: String(r.cropId),
        cropName: String(r.cropNameCustom || r.cropTypeNameMr || r.cropTypeNameEn),
        plotName: String(r.plotName),
        harvestDate: String(r.harvestDate),
        quantity: totalQty,
        unit: harvestUnit,
        notes: r.notes ? String(r.notes) : null,
        createdBy: String(r.createdBy),
        createdByName: String(r.createdByName),
        createdAt: String(r.createdAt),
        soldQuantity: Number(soldInHarvestUnit.toFixed(2)),
        remainingQuantity: Number(remainingInHarvestUnit.toFixed(2)),
      });
    }

    return harvests;
  }

  async getHarvestDetails(groupId: string, harvestId: string) {
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: `
        SELECT 
          h.id, h.group_id as groupId, h.farm_id as farmId, f.farm_name as farmName,
          h.crop_id as cropId, c.crop_name_custom as cropNameCustom,
          ct.crop_name_mr as cropTypeNameMr, ct.crop_name_en as cropTypeNameEn,
          p.plot_name as plotName,
          h.harvest_date as harvestDate, h.quantity, h.unit, h.notes,
          h.created_by as createdBy, u.phone_number as createdByName,
          h.created_at as createdAt, h.updated_at as updatedAt
        FROM harvests h
        JOIN farms f ON f.id = h.farm_id
        JOIN crops c ON c.id = h.crop_id
        JOIN crop_types ct ON ct.id = c.crop_type_id
        JOIN cultivation_plots p ON p.id = c.plot_id
        JOIN users u ON u.id = h.created_by
        WHERE h.id = ? AND h.group_id = ? AND h.is_active = 1
      `,
      args: [harvestId, groupId],
    });

    if (result.rows.length === 0) {
      throw new AppError('काढणी नोंद आढळली नाही (Harvest not found)', 404);
    }

    const row = result.rows[0];
    const harvestUnit = String(row.unit) as HarvestUnit;
    const totalQty = Number(row.quantity);

    // Fetch linked sales
    const salesResult = await client.execute({
      sql: `
        SELECT 
          s.id, s.sale_date as saleDate, s.quantity, s.unit, s.rate_paise as ratePaise,
          s.total_amount_paise as totalAmountPaise, s.buyer_name as buyerName,
          s.created_at as createdAt
        FROM sales s
        WHERE s.harvest_id = ? AND s.group_id = ? AND s.is_active = 1
        ORDER BY s.sale_date DESC, s.created_at DESC
      `,
      args: [harvestId, groupId],
    });

    let soldKg = 0;
    const linkedSales = salesResult.rows.map((s) => {
      const q = Number(s.quantity);
      const u = String(s.unit) as HarvestUnit;
      soldKg += toKg(q, u);
      return {
        id: String(s.id),
        saleDate: String(s.saleDate),
        quantity: q,
        unit: u,
        ratePaise: Number(s.ratePaise),
        totalAmountPaise: Number(s.totalAmountPaise),
        buyerName: s.buyerName ? String(s.buyerName) : null,
        createdAt: String(s.createdAt),
      };
    });

    const totalKg = toKg(totalQty, harvestUnit);
    const remainingKg = Math.max(0, totalKg - soldKg);
    const soldInHarvestUnit = fromKg(soldKg, harvestUnit);
    const remainingInHarvestUnit = fromKg(remainingKg, harvestUnit);

    return {
      id: String(row.id),
      groupId: String(row.groupId),
      farmId: String(row.farmId),
      farmName: String(row.farmName),
      cropId: String(row.cropId),
      cropName: String(row.cropNameCustom || row.cropTypeNameMr || row.cropTypeNameEn),
      plotName: String(row.plotName),
      harvestDate: String(row.harvestDate),
      quantity: totalQty,
      unit: harvestUnit,
      notes: row.notes ? String(row.notes) : null,
      createdBy: String(row.createdBy),
      createdByName: String(row.createdByName),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      soldQuantity: Number(soldInHarvestUnit.toFixed(2)),
      remainingQuantity: Number(remainingInHarvestUnit.toFixed(2)),
      linkedSales,
    };
  }

  async updateHarvest(
    groupId: string,
    harvestId: string,
    userId: string,
    data: {
      harvestDate?: string;
      quantity?: number;
      unit?: HarvestUnit;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();
    const existing = await this.getHarvestDetails(groupId, harvestId);

    const newUnit = data.unit || existing.unit;
    const newQty = data.quantity ?? existing.quantity;

    // Check if new quantity is less than already sold quantity
    const newTotalKg = toKg(newQty, newUnit);
    const soldKg = toKg(existing.soldQuantity, existing.unit);
    if (newTotalKg < soldKg) {
      throw new AppError('काढणीचे प्रमाण आधी केलेल्या विक्री प्रमाणापेक्षा कमी असू शकत नाही (Quantity cannot be less than already sold quantity)', 400);
    }

    const now = new Date().toISOString();
    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          UPDATE harvests SET
            harvest_date = COALESCE(?, harvest_date),
            quantity = COALESCE(?, quantity),
            unit = COALESCE(?, unit),
            notes = COALESCE(?, notes),
            updated_at = ?
          WHERE id = ? AND group_id = ?
        `,
        args: [
          data.harvestDate || null,
          data.quantity || null,
          data.unit || null,
          data.notes !== undefined ? data.notes : null,
          now,
          harvestId,
          groupId,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'HARVEST_UPDATED', 'harvest', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          harvestId,
          JSON.stringify({ updatedFields: Object.keys(data) }),
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

    return this.getHarvestDetails(groupId, harvestId);
  }

  async deleteHarvest(groupId: string, harvestId: string, userId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();
    const existing = await this.getHarvestDetails(groupId, harvestId);

    if (existing.linkedSales.length > 0) {
      throw new AppError('या काढणीशी संबंधित विक्री नोंदी असल्याने ती रद्द करता येणार नाही (Cannot delete harvest with linked sales)', 400);
    }

    const now = new Date().toISOString();
    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: 'UPDATE harvests SET is_active = 0, updated_at = ? WHERE id = ? AND group_id = ?',
        args: [now, harvestId, groupId],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'HARVEST_DELETED', 'harvest', ?, NULL, ?, ?, ?)
        `,
        args: [crypto.randomUUID(), userId, harvestId, ip || null, userAgent || null, now],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    return { success: true };
  }

  // ==========================================
  // 4. SALES
  // ==========================================

  async createSale(
    groupId: string,
    userId: string,
    data: {
      farmId: string;
      cropId: string;
      harvestId?: string | null;
      saleDate: string;
      quantity: number;
      unit: HarvestUnit;
      ratePaise: number;
      totalAmountPaise?: number;
      buyerName?: string | null;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    // Verify farm
    const farmCheck = await client.execute({
      sql: 'SELECT id FROM farms WHERE id = ? AND group_id = ? AND is_active = 1',
      args: [data.farmId, groupId],
    });
    if (farmCheck.rows.length === 0) {
      throw new AppError('शेत आढळले नाही', 404);
    }

    // Verify crop
    const cropCheck = await client.execute({
      sql: "SELECT id FROM crops WHERE id = ? AND group_id = ? AND farm_id = ? AND status != 'cancelled'",
      args: [data.cropId, groupId, data.farmId],
    });
    if (cropCheck.rows.length === 0) {
      throw new AppError('पीक आढळले नाही किंवा शेताशी जोडलेले नाही', 404);
    }

    const calculatedTotal = data.totalAmountPaise || Math.round(data.quantity * data.ratePaise);
    const saleId = crypto.randomUUID();
    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      // Re-verify harvest remaining capacity inside write transaction for strict concurrency safety
      if (data.harvestId) {
        const harvestRow = await txn.execute({
          sql: 'SELECT quantity, unit, crop_id FROM harvests WHERE id = ? AND group_id = ? AND is_active = 1',
          args: [data.harvestId, groupId],
        });
        if (harvestRow.rows.length === 0) {
          throw new AppError('काढणी नोंद आढळली नाही', 404);
        }
        if (String(harvestRow.rows[0].crop_id) !== data.cropId) {
          throw new AppError('निवडलेली काढणी या पिकाची नाही (Harvest does not match crop)', 400);
        }
        const harvestQty = Number(harvestRow.rows[0].quantity);
        const harvestUnit = String(harvestRow.rows[0].unit) as HarvestUnit;
        const totalHarvestKg = toKg(harvestQty, harvestUnit);

        const soldRows = await txn.execute({
          sql: 'SELECT quantity, unit FROM sales WHERE harvest_id = ? AND is_active = 1',
          args: [data.harvestId],
        });
        const soldKg = soldRows.rows.reduce(
          (acc, r) => acc + toKg(Number(r.quantity), String(r.unit) as HarvestUnit),
          0
        );
        const availableKg = Math.max(0, totalHarvestKg - soldKg);
        const requestedKg = toKg(data.quantity, data.unit);

        if (requestedKg > availableKg + 0.0001) {
          const availableInUnit = fromKg(availableKg, data.unit);
          throw new AppError(
            `काढणीच्या शिल्लक प्रमाणापेक्षा जास्त विक्री करता येणार नाही. उपलब्ध: ${availableInUnit} ${data.unit}`,
            400
          );
        }
      }

      await txn.execute({
        sql: `
          INSERT INTO sales (
            id, group_id, farm_id, crop_id, harvest_id, sale_date,
            quantity, unit, rate_paise, total_amount_paise, buyer_name,
            notes, created_by, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `,
        args: [
          saleId,
          groupId,
          data.farmId,
          data.cropId,
          data.harvestId || null,
          data.saleDate,
          data.quantity,
          data.unit,
          data.ratePaise,
          calculatedTotal,
          data.buyerName?.trim() || null,
          data.notes?.trim() || null,
          userId,
          now,
          now,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'SALE_CREATED', 'sale', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          saleId,
          JSON.stringify({
            quantity: data.quantity,
            unit: data.unit,
            ratePaise: data.ratePaise,
            totalAmountPaise: calculatedTotal,
            harvestId: data.harvestId || null,
          }),
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

    return this.getSaleDetails(groupId, saleId);
  }

  async listSales(
    groupId: string,
    filters?: {
      farmId?: string;
      cropId?: string;
      harvestId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const client = getDatabaseClient();
    let sql = `
      SELECT 
        s.id, s.group_id as groupId, s.farm_id as farmId, f.farm_name as farmName,
        s.crop_id as cropId, c.crop_name_custom as cropNameCustom,
        ct.crop_name_mr as cropTypeNameMr, ct.crop_name_en as cropTypeNameEn,
        p.plot_name as plotName,
        s.harvest_id as harvestId, s.sale_date as saleDate,
        s.quantity, s.unit, s.rate_paise as ratePaise, s.total_amount_paise as totalAmountPaise,
        s.buyer_name as buyerName, s.notes,
        s.created_by as createdBy, u.phone_number as createdByName, s.created_at as createdAt,
        COALESCE((SELECT SUM(pay.amount_paise) FROM payments pay WHERE pay.sale_id = s.id), 0) as paidPaise
      FROM sales s
      JOIN farms f ON f.id = s.farm_id
      JOIN crops c ON c.id = s.crop_id
      JOIN crop_types ct ON ct.id = c.crop_type_id
      JOIN cultivation_plots p ON p.id = c.plot_id
      JOIN users u ON u.id = s.created_by
      WHERE s.group_id = ? AND s.is_active = 1
    `;
    const args: InValue[] = [groupId];

    if (filters?.farmId) {
      sql += ' AND s.farm_id = ?';
      args.push(filters.farmId);
    }
    if (filters?.cropId) {
      sql += ' AND s.crop_id = ?';
      args.push(filters.cropId);
    }
    if (filters?.harvestId) {
      sql += ' AND s.harvest_id = ?';
      args.push(filters.harvestId);
    }
    if (filters?.startDate) {
      sql += ' AND s.sale_date >= ?';
      args.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ' AND s.sale_date <= ?';
      args.push(filters.endDate);
    }

    sql += ' ORDER BY s.sale_date DESC, s.created_at DESC';

    const result = await client.execute({ sql, args });

    return result.rows.map((r) => {
      const totalAmountPaise = Number(r.totalAmountPaise);
      const paidPaise = Number(r.paidPaise);
      const balancePaise = Math.max(0, totalAmountPaise - paidPaise);
      const paymentStatus = derivePaymentStatus(totalAmountPaise, paidPaise);

      return {
        id: String(r.id),
        groupId: String(r.groupId),
        farmId: String(r.farmId),
        farmName: String(r.farmName),
        cropId: String(r.cropId),
        cropName: String(r.cropNameCustom || r.cropTypeNameMr || r.cropTypeNameEn),
        plotName: String(r.plotName),
        harvestId: r.harvestId ? String(r.harvestId) : null,
        saleDate: String(r.saleDate),
        quantity: Number(r.quantity),
        unit: String(r.unit) as HarvestUnit,
        ratePaise: Number(r.ratePaise),
        totalAmountPaise,
        paidPaise,
        balancePaise,
        paymentStatus,
        buyerName: r.buyerName ? String(r.buyerName) : null,
        notes: r.notes ? String(r.notes) : null,
        createdBy: String(r.createdBy),
        createdByName: String(r.createdByName),
        createdAt: String(r.createdAt),
      };
    });
  }

  async getSaleDetails(groupId: string, saleId: string) {
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: `
        SELECT 
          s.id, s.group_id as groupId, s.farm_id as farmId, f.farm_name as farmName,
          s.crop_id as cropId, c.crop_name_custom as cropNameCustom,
          ct.crop_name_mr as cropTypeNameMr, ct.crop_name_en as cropTypeNameEn,
          p.plot_name as plotName,
          s.harvest_id as harvestId, s.sale_date as saleDate,
          s.quantity, s.unit, s.rate_paise as ratePaise, s.total_amount_paise as totalAmountPaise,
          s.buyer_name as buyerName, s.notes,
          s.created_by as createdBy, u.phone_number as createdByName,
          s.created_at as createdAt, s.updated_at as updatedAt,
          COALESCE((SELECT SUM(pay.amount_paise) FROM payments pay WHERE pay.sale_id = s.id), 0) as paidPaise
        FROM sales s
        JOIN farms f ON f.id = s.farm_id
        JOIN crops c ON c.id = s.crop_id
        JOIN crop_types ct ON ct.id = c.crop_type_id
        JOIN cultivation_plots p ON p.id = c.plot_id
        JOIN users u ON u.id = s.created_by
        WHERE s.id = ? AND s.group_id = ? AND s.is_active = 1
      `,
      args: [saleId, groupId],
    });

    if (result.rows.length === 0) {
      throw new AppError('विक्री नोंद आढळली नाही (Sale not found)', 404);
    }

    const row = result.rows[0];
    const totalAmountPaise = Number(row.totalAmountPaise);
    const paidPaise = Number(row.paidPaise);
    const balancePaise = Math.max(0, totalAmountPaise - paidPaise);
    const paymentStatus = derivePaymentStatus(totalAmountPaise, paidPaise);

    // Fetch payments
    const paymentsResult = await client.execute({
      sql: `
        SELECT 
          p.id, p.amount_paise as amountPaise, p.payment_date as paymentDate,
          p.payment_method as paymentMethod, p.reference_number as referenceNumber,
          p.notes, p.created_at as createdAt, u.phone_number as createdByName
        FROM payments p
        JOIN users u ON u.id = p.created_by
        WHERE p.sale_id = ? AND p.group_id = ?
        ORDER BY p.payment_date DESC, p.created_at DESC
      `,
      args: [saleId, groupId],
    });

    const payments = paymentsResult.rows.map((p) => ({
      id: String(p.id),
      amountPaise: Number(p.amountPaise),
      paymentDate: String(p.paymentDate),
      paymentMethod: String(p.paymentMethod) as PaymentMethod,
      referenceNumber: p.referenceNumber ? String(p.referenceNumber) : null,
      notes: p.notes ? String(p.notes) : null,
      createdAt: String(p.createdAt),
      createdByName: String(p.createdByName),
    }));

    return {
      id: String(row.id),
      groupId: String(row.groupId),
      farmId: String(row.farmId),
      farmName: String(row.farmName),
      cropId: String(row.cropId),
      cropName: String(row.cropNameCustom || row.cropTypeNameMr || row.cropTypeNameEn),
      plotName: String(row.plotName),
      harvestId: row.harvestId ? String(row.harvestId) : null,
      saleDate: String(row.saleDate),
      quantity: Number(row.quantity),
      unit: String(row.unit) as HarvestUnit,
      ratePaise: Number(row.ratePaise),
      totalAmountPaise,
      paidPaise,
      balancePaise,
      paymentStatus,
      buyerName: row.buyerName ? String(row.buyerName) : null,
      notes: row.notes ? String(row.notes) : null,
      createdBy: String(row.createdBy),
      createdByName: String(row.createdByName),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      payments,
    };
  }

  async updateSale(
    groupId: string,
    saleId: string,
    userId: string,
    data: {
      saleDate?: string;
      quantity?: number;
      unit?: HarvestUnit;
      ratePaise?: number;
      totalAmountPaise?: number;
      buyerName?: string | null;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();
    const existing = await this.getSaleDetails(groupId, saleId);

    const newQty = data.quantity ?? existing.quantity;
    const newUnit = data.unit ?? existing.unit;
    const newRate = data.ratePaise ?? existing.ratePaise;
    const newTotal = data.totalAmountPaise ?? Math.round(newQty * newRate);

    if (newTotal < existing.paidPaise) {
      throw new AppError('विक्रीची एकूण रक्कम मिळालेल्या पेमेंटपेक्षा कमी असू शकत नाही', 400);
    }

    if (existing.harvestId && (data.quantity !== undefined || data.unit !== undefined)) {
      const harvestDetails = await this.getHarvestDetails(groupId, existing.harvestId);
      const existingSaleKg = toKg(existing.quantity, existing.unit);
      const newSaleKg = toKg(newQty, newUnit);
      const availableKg = toKg(harvestDetails.remainingQuantity, harvestDetails.unit) + existingSaleKg;

      if (newSaleKg > availableKg + 0.0001) {
        throw new AppError('काढणीच्या उपलब्ध प्रमाणापेक्षा जास्त विक्री करता येणार नाही', 400);
      }
    }

    const now = new Date().toISOString();
    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: `
          UPDATE sales SET
            sale_date = COALESCE(?, sale_date),
            quantity = COALESCE(?, quantity),
            unit = COALESCE(?, unit),
            rate_paise = COALESCE(?, rate_paise),
            total_amount_paise = COALESCE(?, total_amount_paise),
            buyer_name = COALESCE(?, buyer_name),
            notes = COALESCE(?, notes),
            updated_at = ?
          WHERE id = ? AND group_id = ?
        `,
        args: [
          data.saleDate || null,
          data.quantity || null,
          data.unit || null,
          data.ratePaise || null,
          newTotal,
          data.buyerName !== undefined ? data.buyerName : null,
          data.notes !== undefined ? data.notes : null,
          now,
          saleId,
          groupId,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'SALE_UPDATED', 'sale', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          saleId,
          JSON.stringify({ updatedFields: Object.keys(data) }),
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

    return this.getSaleDetails(groupId, saleId);
  }

  async deleteSale(groupId: string, saleId: string, userId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();
    await this.getSaleDetails(groupId, saleId);

    const now = new Date().toISOString();
    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: 'UPDATE sales SET is_active = 0, updated_at = ? WHERE id = ? AND group_id = ?',
        args: [now, saleId, groupId],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'SALE_DELETED', 'sale', ?, NULL, ?, ?, ?)
        `,
        args: [crypto.randomUUID(), userId, saleId, ip || null, userAgent || null, now],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    return { success: true };
  }

  // ==========================================
  // 5. REUSABLE PAYMENTS
  // ==========================================

  async recordPayment(
    groupId: string,
    userId: string,
    data: {
      expenseId?: string | null;
      saleId?: string | null;
      amountPaise: number;
      paymentDate: string;
      paymentMethod: PaymentMethod;
      referenceNumber?: string | null;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string
  ) {
    const client = getDatabaseClient();

    if ((data.expenseId && data.saleId) || (!data.expenseId && !data.saleId)) {
      throw new AppError('पेमेंट केवळ खर्चासाठी किंवा विक्रीसाठीच नोंदवले जाऊ शकते (Payment must be for either expense or sale)', 400);
    }

    const paymentId = crypto.randomUUID();
    const now = new Date().toISOString();

    const txn = await client.transaction('write');
    try {
      // Re-verify outstanding balance inside write transaction for strict race condition & overpayment prevention
      if (data.expenseId) {
        const expRow = await txn.execute({
          sql: 'SELECT amount_paise FROM expenses WHERE id = ? AND group_id = ? AND is_active = 1',
          args: [data.expenseId, groupId],
        });
        if (expRow.rows.length === 0) {
          throw new AppError('खर्च आढळला नाही', 404);
        }
        const expTotalPaise = Number(expRow.rows[0].amount_paise);
        const paidRow = await txn.execute({
          sql: 'SELECT COALESCE(SUM(amount_paise), 0) as paidPaise FROM payments WHERE expense_id = ?',
          args: [data.expenseId],
        });
        const currentPaid = Number(paidRow.rows[0].paidPaise);
        const currentBalance = Math.max(0, expTotalPaise - currentPaid);
        if (data.amountPaise > currentBalance) {
          throw new AppError(`पेमेंट शिल्लक रक्कमेपेक्षा (${currentBalance / 100} रु.) जास्त असू शकत नाही`, 400);
        }
      }

      if (data.saleId) {
        const saleRow = await txn.execute({
          sql: 'SELECT total_amount_paise FROM sales WHERE id = ? AND group_id = ? AND is_active = 1',
          args: [data.saleId, groupId],
        });
        if (saleRow.rows.length === 0) {
          throw new AppError('विक्री नोंद आढळली नाही', 404);
        }
        const saleTotalPaise = Number(saleRow.rows[0].total_amount_paise);
        const paidRow = await txn.execute({
          sql: 'SELECT COALESCE(SUM(amount_paise), 0) as paidPaise FROM payments WHERE sale_id = ?',
          args: [data.saleId],
        });
        const currentPaid = Number(paidRow.rows[0].paidPaise);
        const currentBalance = Math.max(0, saleTotalPaise - currentPaid);
        if (data.amountPaise > currentBalance) {
          throw new AppError(`पेमेंट शिल्लक रक्कमेपेक्षा (${currentBalance / 100} रु.) जास्त असू शकत नाही`, 400);
        }
      }

      await txn.execute({
        sql: `
          INSERT INTO payments (
            id, group_id, expense_id, sale_id, amount_paise,
            payment_date, payment_method, reference_number, notes,
            created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          paymentId,
          groupId,
          data.expenseId || null,
          data.saleId || null,
          data.amountPaise,
          data.paymentDate,
          data.paymentMethod,
          data.referenceNumber?.trim() || null,
          data.notes?.trim() || null,
          userId,
          now,
          now,
        ],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'PAYMENT_RECORDED', 'payment', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          paymentId,
          JSON.stringify({
            amountPaise: data.amountPaise,
            paymentMethod: data.paymentMethod,
            expenseId: data.expenseId || null,
            saleId: data.saleId || null,
          }),
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

    logger.info('Payment recorded', { paymentId, groupId, amountPaise: data.amountPaise });

    return {
      id: paymentId,
      groupId,
      expenseId: data.expenseId || null,
      saleId: data.saleId || null,
      amountPaise: data.amountPaise,
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod,
      referenceNumber: data.referenceNumber?.trim() || null,
      notes: data.notes?.trim() || null,
      createdAt: now,
    };
  }

  async deletePayment(groupId: string, paymentId: string, userId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();

    const check = await client.execute({
      sql: 'SELECT id, expense_id, sale_id, amount_paise FROM payments WHERE id = ? AND group_id = ?',
      args: [paymentId, groupId],
    });
    if (check.rows.length === 0) {
      throw new AppError('पेमेंट नोंद आढळली नाही (Payment not found)', 404);
    }

    const now = new Date().toISOString();
    const txn = await client.transaction('write');
    try {
      await txn.execute({
        sql: 'DELETE FROM payments WHERE id = ? AND group_id = ?',
        args: [paymentId, groupId],
      });

      await txn.execute({
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'PAYMENT_DELETED', 'payment', ?, NULL, ?, ?, ?)
        `,
        args: [crypto.randomUUID(), userId, paymentId, ip || null, userAgent || null, now],
      });

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }

    return { success: true };
  }

  // ==========================================
  // 6. FINANCIAL SUMMARY & REPORTS
  // ==========================================

  async getFinancialSummary(
    groupId: string,
    filters?: {
      farmId?: string;
      cropId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const client = getDatabaseClient();

    // 1. Accrual Sales
    let salesSql = `
      SELECT COALESCE(SUM(total_amount_paise), 0) as totalSalesPaise
      FROM sales
      WHERE group_id = ? AND is_active = 1
    `;
    const salesArgs: InValue[] = [groupId];
    if (filters?.farmId) {
      salesSql += ' AND farm_id = ?';
      salesArgs.push(filters.farmId);
    }
    if (filters?.cropId) {
      salesSql += ' AND crop_id = ?';
      salesArgs.push(filters.cropId);
    }
    if (filters?.startDate) {
      salesSql += ' AND sale_date >= ?';
      salesArgs.push(filters.startDate);
    }
    if (filters?.endDate) {
      salesSql += ' AND sale_date <= ?';
      salesArgs.push(filters.endDate);
    }
    const salesRes = await client.execute({ sql: salesSql, args: salesArgs });
    const totalSalesPaise = Number(salesRes.rows[0].totalSalesPaise);

    // 2. Accrual Expenses
    let expensesSql = `
      SELECT COALESCE(SUM(amount_paise), 0) as totalExpensesPaise
      FROM expenses
      WHERE group_id = ? AND is_active = 1
    `;
    const expensesArgs: InValue[] = [groupId];
    if (filters?.farmId) {
      expensesSql += ' AND farm_id = ?';
      expensesArgs.push(filters.farmId);
    }
    if (filters?.cropId) {
      expensesSql += ' AND EXISTS (SELECT 1 FROM expense_allocations ea WHERE ea.expense_id = expenses.id AND ea.crop_id = ?)';
      expensesArgs.push(filters.cropId);
    }
    if (filters?.startDate) {
      expensesSql += ' AND expense_date >= ?';
      expensesArgs.push(filters.startDate);
    }
    if (filters?.endDate) {
      expensesSql += ' AND expense_date <= ?';
      expensesArgs.push(filters.endDate);
    }
    const expensesRes = await client.execute({ sql: expensesSql, args: expensesArgs });
    const totalExpensesPaise = Number(expensesRes.rows[0].totalExpensesPaise);

    // 3. Cash Inflow (Payments received on sales excluding pure credit)
    let inflowSql = `
      SELECT COALESCE(SUM(p.amount_paise), 0) as cashInflowPaise
      FROM payments p
      JOIN sales s ON s.id = p.sale_id
      WHERE p.group_id = ? AND s.is_active = 1 AND p.payment_method != 'credit'
    `;
    const inflowArgs: InValue[] = [groupId];
    if (filters?.farmId) {
      inflowSql += ' AND s.farm_id = ?';
      inflowArgs.push(filters.farmId);
    }
    if (filters?.cropId) {
      inflowSql += ' AND s.crop_id = ?';
      inflowArgs.push(filters.cropId);
    }
    if (filters?.startDate) {
      inflowSql += ' AND p.payment_date >= ?';
      inflowArgs.push(filters.startDate);
    }
    if (filters?.endDate) {
      inflowSql += ' AND p.payment_date <= ?';
      inflowArgs.push(filters.endDate);
    }
    const inflowRes = await client.execute({ sql: inflowSql, args: inflowArgs });
    const cashInflowPaise = Number(inflowRes.rows[0].cashInflowPaise);

    // 4. Cash Outflow (Payments paid for expenses excluding pure credit)
    let outflowSql = `
      SELECT COALESCE(SUM(p.amount_paise), 0) as cashOutflowPaise
      FROM payments p
      JOIN expenses e ON e.id = p.expense_id
      WHERE p.group_id = ? AND e.is_active = 1 AND p.payment_method != 'credit'
    `;
    const outflowArgs: InValue[] = [groupId];
    if (filters?.farmId) {
      outflowSql += ' AND e.farm_id = ?';
      outflowArgs.push(filters.farmId);
    }
    if (filters?.cropId) {
      outflowSql += ' AND EXISTS (SELECT 1 FROM expense_allocations ea WHERE ea.expense_id = e.id AND ea.crop_id = ?)';
      outflowArgs.push(filters.cropId);
    }
    if (filters?.startDate) {
      outflowSql += ' AND p.payment_date >= ?';
      outflowArgs.push(filters.startDate);
    }
    if (filters?.endDate) {
      outflowSql += ' AND p.payment_date <= ?';
      outflowArgs.push(filters.endDate);
    }
    const outflowRes = await client.execute({ sql: outflowSql, args: outflowArgs });
    const cashOutflowPaise = Number(outflowRes.rows[0].cashOutflowPaise);

    // 5. Total Paid on Sales (All methods including credit settlements, matching sales filters)
    let salesPaidSql = `
      SELECT COALESCE(SUM(p.amount_paise), 0) as totalSalesPaidPaise
      FROM payments p
      JOIN sales s ON s.id = p.sale_id
      WHERE p.group_id = ? AND s.is_active = 1
    `;
    const salesPaidArgs: InValue[] = [groupId];
    if (filters?.farmId) {
      salesPaidSql += ' AND s.farm_id = ?';
      salesPaidArgs.push(filters.farmId);
    }
    if (filters?.cropId) {
      salesPaidSql += ' AND s.crop_id = ?';
      salesPaidArgs.push(filters.cropId);
    }
    if (filters?.startDate) {
      salesPaidSql += ' AND s.sale_date >= ?';
      salesPaidArgs.push(filters.startDate);
    }
    if (filters?.endDate) {
      salesPaidSql += ' AND s.sale_date <= ?';
      salesPaidArgs.push(filters.endDate);
    }
    const salesPaidRes = await client.execute({ sql: salesPaidSql, args: salesPaidArgs });
    const totalSalesPaidPaise = Number(salesPaidRes.rows[0].totalSalesPaidPaise);

    // 6. Total Paid on Expenses (Matching expense filters)
    let expensesPaidSql = `
      SELECT COALESCE(SUM(p.amount_paise), 0) as totalExpensesPaidPaise
      FROM payments p
      JOIN expenses e ON e.id = p.expense_id
      WHERE p.group_id = ? AND e.is_active = 1
    `;
    const expensesPaidArgs: InValue[] = [groupId];
    if (filters?.farmId) {
      expensesPaidSql += ' AND e.farm_id = ?';
      expensesPaidArgs.push(filters.farmId);
    }
    if (filters?.cropId) {
      expensesPaidSql += ' AND EXISTS (SELECT 1 FROM expense_allocations ea WHERE ea.expense_id = e.id AND ea.crop_id = ?)';
      expensesPaidArgs.push(filters.cropId);
    }
    if (filters?.startDate) {
      expensesPaidSql += ' AND e.expense_date >= ?';
      expensesPaidArgs.push(filters.startDate);
    }
    if (filters?.endDate) {
      expensesPaidSql += ' AND e.expense_date <= ?';
      expensesPaidArgs.push(filters.endDate);
    }
    const expensesPaidRes = await client.execute({ sql: expensesPaidSql, args: expensesPaidArgs });
    const totalExpensesPaidPaise = Number(expensesPaidRes.rows[0].totalExpensesPaidPaise);

    const netProfitPaise = totalSalesPaise - totalExpensesPaise;
    const netCashFlowPaise = cashInflowPaise - cashOutflowPaise;
    const receivablesPaise = Math.max(0, totalSalesPaise - totalSalesPaidPaise);
    const payablesPaise = Math.max(0, totalExpensesPaise - totalExpensesPaidPaise);

    // 7. Category Breakdown
    const categoryRes = await client.execute({
      sql: `
        SELECT ec.id, ec.name_mr as nameMr, ec.name_en as nameEn,
               COALESCE(SUM(e.amount_paise), 0) as totalPaise,
               COUNT(e.id) as count
        FROM expense_categories ec
        LEFT JOIN expenses e ON e.expense_category_id = ec.id AND e.group_id = ? AND e.is_active = 1
        WHERE (ec.is_system = 1 OR ec.group_id = ?) AND ec.is_active = 1
        GROUP BY ec.id
        HAVING totalPaise > 0
        ORDER BY totalPaise DESC
      `,
      args: [groupId, groupId],
    });

    const categoryBreakdown = categoryRes.rows.map((r) => ({
      categoryId: String(r.id),
      nameMr: String(r.nameMr),
      nameEn: String(r.nameEn),
      totalPaise: Number(r.totalPaise),
      count: Number(r.count),
    }));

    return {
      totalSalesPaise,
      totalExpensesPaise,
      netProfitPaise,
      cashInflowPaise,
      cashOutflowPaise,
      netCashFlowPaise,
      receivablesPaise,
      payablesPaise,
      categoryBreakdown,
    };
  }
}
