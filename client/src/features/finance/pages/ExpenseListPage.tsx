import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { agricultureApi } from '../../agriculture/services/agricultureApi';
import { Expense } from '../types';
import { Farm } from '../../agriculture/types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { formatCurrency } from '../../../utils/finance';
import {
  Receipt,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';

export const ExpenseListPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const [expRes, farmRes] = await Promise.all([
        financeApi.getExpenses(selectedGroup.id, {
          farmId: selectedFarmId || undefined,
        }),
        agricultureApi.getFarms(selectedGroup.id),
      ]);
      setExpenses(expRes || []);
      setFarms(farmRes || []);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'खर्च माहिती आणता आली नाही');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup, selectedFarmId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Calculations
  const totalExpensePaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  const totalPaidPaise = expenses.reduce((sum, e) => sum + e.paidPaise, 0);
  const totalBalancePaise = expenses.reduce((sum, e) => sum + e.balancePaise, 0);

  const getStatusBadge = (status: Expense['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {lang === 'mr' ? 'पूर्ण भरले' : 'Paid'}
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            {lang === 'mr' ? 'अंशतः भरले' : 'Partially Paid'}
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            {lang === 'mr' ? 'बाकी' : 'Unpaid'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {lang === 'mr' ? 'शेती खर्च नोंदवही' : 'Farm Expenses'}
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {lang === 'mr'
              ? 'शेताचे व पिकांचे सर्व खर्च, वाटप आणि देयके एकाच ठिकाणी'
              : 'Track farm & crop-wise expenditures, allocations and payments'}
          </p>
        </div>

        <Link to="/expenses/new">
          <Button className="w-full sm:w-auto bg-brand-green hover:bg-brand-green-hover shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {lang === 'mr' ? 'नवीन खर्च नोंदवा' : 'Record Expense'}
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-rose-50/50 to-white border-rose-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'एकूण खर्च' : 'Total Expenses'}
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {formatCurrency(totalExpensePaise, lang)}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {expenses.length} {lang === 'mr' ? 'नोंदी' : 'records'}
          </span>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50/50 to-white border-emerald-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'एकूण दिलेले पेमेंट' : 'Total Paid'}
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            {formatCurrency(totalPaidPaise, lang)}
          </span>
          <span className="text-xs text-emerald-600 mt-1 block">
            {totalExpensePaise > 0 ? Math.round((totalPaidPaise / totalExpensePaise) * 100) : 0}%{' '}
            {lang === 'mr' ? 'चुकता' : 'settled'}
          </span>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50/50 to-white border-amber-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'शिल्लक देणे बाकी' : 'Outstanding Balance'}
          </span>
          <span className="text-2xl font-bold text-amber-700 mt-1 block">
            {formatCurrency(totalBalancePaise, lang)}
          </span>
          <span className="text-xs text-amber-600 mt-1 block">
            {expenses.filter((e) => e.balancePaise > 0).length} {lang === 'mr' ? 'खर्च बाकी' : 'unpaid'}
          </span>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-200">
        <Filter className="w-4 h-4 text-slate-400 ml-1" />
        <select
          value={selectedFarmId}
          onChange={(e) => setSelectedFarmId(e.target.value)}
          className="text-sm bg-transparent border-none text-slate-700 focus:outline-none focus:ring-0 font-medium"
        >
          <option value="">{lang === 'mr' ? 'सर्व शेते (All Farms)' : 'All Farms'}</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.farmName} ({f.village})
            </option>
          ))}
        </select>
      </div>

      {/* Expense List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-2">{lang === 'mr' ? 'खर्च लोड होत आहेत...' : 'Loading expenses...'}</p>
        </div>
      ) : expenses.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            {lang === 'mr' ? 'कोणताही खर्च नोंदवलेला नाही' : 'No expenses recorded yet'}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {lang === 'mr'
              ? 'बियाणे, खते, मजुरी इत्यादी शेती खर्चांची नोंद ठेवून हिशोब स्वच्छ ठेवा.'
              : 'Keep your farm books clean by recording seeds, fertilizers, labour and other costs.'}
          </p>
          <Link to="/expenses/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {lang === 'mr' ? 'पहिला खर्च नोंदवा' : 'Record First Expense'}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <Link key={expense.id} to={`/expenses/${expense.id}`}>
              <Card className="hover:border-slate-300 transition-all p-4 flex items-center justify-between group">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-base">
                      {lang === 'mr' ? expense.categoryNameMr : expense.categoryNameEn}
                    </span>
                    {getStatusBadge(expense.paymentStatus)}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{expense.farmName}</span>
                    <span>•</span>
                    <span>{expense.expenseDate}</span>
                    {expense.allocatedPaise > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {lang === 'mr' ? 'पिकाला वाटप:' : 'Allocated:'}{' '}
                          {formatCurrency(expense.allocatedPaise, lang)}
                        </span>
                      </>
                    )}
                  </div>

                  {expense.description && (
                    <p className="text-xs text-slate-600 line-clamp-1 italic">
                      &quot;{expense.description}&quot;
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-4 text-right">
                  <div>
                    <span className="font-bold text-slate-900 text-base block">
                      {formatCurrency(expense.amountPaise, lang)}
                    </span>
                    {expense.balancePaise > 0 ? (
                      <span className="text-xs font-semibold text-amber-600 block">
                        {lang === 'mr' ? 'बाकी:' : 'Due:'} {formatCurrency(expense.balancePaise, lang)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-emerald-600 block">
                        {lang === 'mr' ? 'पूर्ण चुकता' : 'Paid in Full'}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-green group-hover:translate-x-0.5 transition-all" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
