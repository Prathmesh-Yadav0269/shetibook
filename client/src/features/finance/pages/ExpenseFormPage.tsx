import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { agricultureApi } from '../../agriculture/services/agricultureApi';
import { ExpenseCategory, ExpenseAllocation } from '../types';
import { Farm, Crop } from '../../agriculture/types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Alert } from '../../../components/ui/Alert';
import { toPaise, fromPaise, formatCurrency } from '../../../utils/finance';
import {
  ArrowLeft,
  Plus,
  Trash2,
  PieChart,
  CheckCircle2,
} from 'lucide-react';

interface AllocationState {
  cropId: string;
  rupees: string;
}

export const ExpenseFormPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const { expenseId } = useParams<{ expenseId: string }>();
  const isEditing = Boolean(expenseId);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [farms, setFarms] = useState<Farm[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [availableCrops, setAvailableCrops] = useState<Crop[]>([]);

  // Form states
  const [farmId, setFarmId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [allocations, setAllocations] = useState<AllocationState[]>([]);

  // Custom Category Modal/Inline
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatMr, setNewCatMr] = useState('');
  const [newCatEn, setNewCatEn] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      const [farmRes, catRes] = await Promise.all([
        agricultureApi.getFarms(selectedGroup.id),
        financeApi.getCategories(selectedGroup.id),
      ]);
      setFarms(farmRes || []);
      setCategories(catRes || []);

      if (farmRes?.length && !farmId) {
        setFarmId(farmRes[0].id);
      }
      if (catRes?.length && !categoryId) {
        setCategoryId(catRes[0].id);
      }

      if (isEditing && expenseId) {
        const exp = await financeApi.getExpense(selectedGroup.id, expenseId);
        setFarmId(exp.farmId);
        setCategoryId(exp.categoryId);
        setAmountRupees(fromPaise(exp.amountPaise).toString());
        setExpenseDate(exp.expenseDate);
        setDescription(exp.description || '');
        if (exp.allocations && exp.allocations.length > 0) {
          setAllocations(
            exp.allocations.map((a: ExpenseAllocation) => ({
              cropId: a.cropId,
              rupees: fromPaise(a.amountPaise).toString(),
            }))
          );
        }
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'माहिती आणता आली नाही');
    }
  }, [selectedGroup, isEditing, expenseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load crops for selected farm
  useEffect(() => {
    if (!selectedGroup || !farmId) return;
    agricultureApi.getCrops(selectedGroup.id, { farmId }).then((res) => {
      setAvailableCrops(res || []);
    });
  }, [selectedGroup, farmId]);

  // Allocation calculations
  const totalExpensePaise = amountRupees ? toPaise(parseFloat(amountRupees) || 0) : 0;
  const totalAllocatedPaise = allocations.reduce((sum, item) => {
    const r = parseFloat(item.rupees);
    return sum + (isNaN(r) ? 0 : toPaise(r));
  }, 0);
  const unallocatedPaise = Math.max(0, totalExpensePaise - totalAllocatedPaise);
  const isOverAllocated = totalAllocatedPaise > totalExpensePaise;

  const handleAddAllocation = () => {
    if (availableCrops.length === 0) return;
    const unusedCrop = availableCrops.find((c) => !allocations.some((a) => a.cropId === c.id));
    if (!unusedCrop) return;
    setAllocations([...allocations, { cropId: unusedCrop.id, rupees: '' }]);
  };

  const handleRemoveAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const handleAllocationChange = (index: number, field: keyof AllocationState, value: string) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    setAllocations(updated);
  };

  const handleCreateCategory = async () => {
    if (!selectedGroup || !newCatMr.trim() || !newCatEn.trim()) return;
    try {
      const res = await financeApi.createCategory(selectedGroup.id, {
        nameMr: newCatMr.trim(),
        nameEn: newCatEn.trim(),
      });
      setCategories([...categories, res]);
      setCategoryId(res.id);
      setShowAddCategory(false);
      setNewCatMr('');
      setNewCatEn('');
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'प्रवर्ग तयार करता आला नाही');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    setError(null);

    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setError(lang === 'mr' ? 'कृपया वैध सकारात्मक रक्कम प्रविष्ट करा' : 'Please enter a valid positive amount');
      return;
    }

    if (isOverAllocated) {
      setError(
        lang === 'mr'
          ? 'पिकांना वाटप केलेली एकूण रक्कम मूळ खर्चापेक्षा जास्त असू शकत नाही'
          : 'Allocations cannot exceed total expense amount'
      );
      return;
    }

    const formattedAllocations = allocations
      .filter((a) => a.cropId && parseFloat(a.rupees) > 0)
      .map((a) => ({
        cropId: a.cropId,
        amountPaise: toPaise(parseFloat(a.rupees)),
      }));

    try {
      setIsSaving(true);
      if (isEditing && expenseId) {
        await financeApi.updateExpense(selectedGroup.id, expenseId, {
          farmId,
          expenseCategoryId: categoryId,
          amountPaise: toPaise(rupees),
          expenseDate,
          description: description.trim() || null,
          allocations: formattedAllocations,
        });
      } else {
        await financeApi.createExpense(selectedGroup.id, {
          farmId,
          expenseCategoryId: categoryId,
          amountPaise: toPaise(rupees),
          expenseDate,
          description: description.trim() || null,
          allocations: formattedAllocations,
        });
      }

      navigate('/expenses');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(errObj.response?.data?.error?.message || errObj.message || 'खर्च नोंदवता आला नाही');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Link
          to="/expenses"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing
              ? lang === 'mr'
                ? 'खर्च दुरुस्त करा'
                : 'Edit Expense'
              : lang === 'mr'
              ? 'नवीन खर्च नोंदवा'
              : 'Record Expense'}
          </h1>
          <p className="text-xs text-slate-500">
            {lang === 'mr'
              ? 'खर्चाची अचूक रक्कम आणि ऐच्छिक पीक वाटप भरा'
              : 'Fill expense details and optional crop allocations'}
          </p>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Farm selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {lang === 'mr' ? 'शेत निवडा *' : 'Select Farm *'}
            </label>
            <select
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green"
              required
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmName} ({f.village})
                </option>
              ))}
            </select>
          </div>

          {/* Category selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">
                {lang === 'mr' ? 'खर्च प्रवर्ग *' : 'Expense Category *'}
              </label>
              <button
                type="button"
                onClick={() => setShowAddCategory(!showAddCategory)}
                className="text-xs text-brand-green hover:underline font-semibold flex items-center"
              >
                <Plus className="w-3 h-3 mr-0.5" />
                {lang === 'mr' ? '+ नवीन प्रवर्ग' : '+ New Category'}
              </button>
            </div>

            {showAddCategory && (
              <div className="p-3 mb-2 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2 animate-fade-in">
                <span className="text-xs font-semibold text-emerald-800 block">
                  {lang === 'mr' ? 'नवीन सानुकूल प्रवर्ग जोडा' : 'Add Custom Category'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="मराठी नाव (उदा. वायर फेंसिंग)"
                    value={newCatMr}
                    onChange={(e) => setNewCatMr(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="English name (e.g. Fencing)"
                    value={newCatEn}
                    onChange={(e) => setNewCatEn(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddCategory(false)}
                  >
                    {lang === 'mr' ? 'रद्द' : 'Cancel'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateCategory}
                    disabled={!newCatMr.trim() || !newCatEn.trim()}
                  >
                    {lang === 'mr' ? 'जोडा' : 'Add'}
                  </Button>
                </div>
              </div>
            )}

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === 'mr' ? c.nameMr : c.nameEn} {c.isSystem ? '' : '(सानुकूल)'}
                </option>
              ))}
            </select>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={lang === 'mr' ? 'एकूण रक्कम (रु.) *' : 'Total Amount (₹) *'}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="उदा. 4500"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              required
            />

            <Input
              label={lang === 'mr' ? 'खर्च तारीख *' : 'Expense Date *'}
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <Input
            label={lang === 'mr' ? 'खर्चाचा तपशील / वर्णन (ऐच्छिक)' : 'Description / Notes (Optional)'}
            type="text"
            placeholder="उदा. ५ गोणी डीएपी, २ पोती युरिया खरेदी"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Optional Crop Allocation Section */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <PieChart className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {lang === 'mr' ? 'पिकांना खर्च वाटप (ऐच्छिक)' : 'Crop Allocations (Optional)'}
                </h3>
              </div>
              {availableCrops.length > allocations.length && (
                <button
                  type="button"
                  onClick={handleAddAllocation}
                  className="text-xs text-brand-green hover:underline font-semibold flex items-center"
                >
                  <Plus className="w-3.5 h-3.5 mr-0.5" />
                  {lang === 'mr' ? 'पीक जोडा' : 'Add Crop'}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {lang === 'mr'
                ? 'हा खर्च विशिष्ट पिकासाठी झाला असल्यास ते निवडा. न वाटलेली रक्कम आपोआप संपूर्ण शेताच्या नावावर राहील.'
                : 'Assign expenditure to specific crops. Any unallocated amount automatically remains as general farm expense.'}
            </p>

            {allocations.map((alloc, idx) => (
              <div key={idx} className="flex items-center space-x-2 mb-2 animate-fade-in">
                <select
                  value={alloc.cropId}
                  onChange={(e) => handleAllocationChange(idx, 'cropId', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-green"
                >
                  {availableCrops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cropNameCustom || c.cropNameMr || c.cropNameEn} ({c.plotName})
                    </option>
                  ))}
                </select>

                <div className="w-32">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="रक्कम रु."
                    value={alloc.rupees}
                    onChange={(e) => handleAllocationChange(idx, 'rupees', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-green"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveAllocation(idx)}
                  className="p-1 text-slate-400 hover:text-red-500"
                  title="काढून टाका"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Allocation Balance Indicator */}
            {amountRupees && parseFloat(amountRupees) > 0 && (
              <div
                className={`mt-3 p-3 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 border ${
                  isOverAllocated
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div>
                  <span className="block font-medium">
                    {lang === 'mr' ? 'पिकांना वाटप:' : 'Allocated:'}{' '}
                    <strong>{formatCurrency(totalAllocatedPaise, lang)}</strong>
                  </span>
                </div>
                <div>
                  <span className="block font-medium">
                    {lang === 'mr' ? 'सामान्य शेत खर्च:' : 'General Farm Cost:'}{' '}
                    <strong>{formatCurrency(unallocatedPaise, lang)}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <Link to="/expenses">
              <Button type="button" variant="outline" disabled={isSaving}>
                {lang === 'mr' ? 'रद्द करा' : 'Cancel'}
              </Button>
            </Link>
            <Button type="submit" isLoading={isSaving} disabled={isOverAllocated}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {isEditing
                ? lang === 'mr'
                  ? 'बदल जतन करा'
                  : 'Save Changes'
                : lang === 'mr'
                ? 'खर्च जतन करा'
                : 'Save Expense'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
