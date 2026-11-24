import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { FinancialSummary } from '../types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { formatCurrency } from '../../../utils/finance';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Receipt,
  ShoppingBag,
  Wheat,
  PieChart,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
} from 'lucide-react';

export const FinanceSummaryPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await financeApi.getFinancialSummary(selectedGroup.id);
      setSummary(res);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'आर्थिक हिशोब लोड करता आला नाही');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-2">{lang === 'mr' ? 'हिशोब लोड होत आहे...' : 'Loading summary...'}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="text-center py-12">
        <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-2" />
        <h3 className="font-semibold text-slate-800">
          {lang === 'mr' ? 'आर्थिक माहिती उपलब्ध नाही' : 'No Financial Data Available'}
        </h3>
      </Card>
    );
  }

  const isProfit = summary.netProfitPaise >= 0;
  const isPositiveCashFlow = summary.netCashFlowPaise >= 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {lang === 'mr' ? 'शेती नफा-तोटा व आर्थिक अहवाल' : 'Farm Profit & Loss & Financial Report'}
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {lang === 'mr'
              ? 'शेतीचा एकूण नफा/तोटा, रोख आवक-जावक आणि येणे-देणे हिशोब एका दृष्टीक्षेपात'
              : 'Accrual profit & loss, realized cash flow and balance overview'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link to="/expenses/new">
            <Button size="sm" variant="outline">
              <Receipt className="w-4 h-4 mr-1" />
              {lang === 'mr' ? 'खर्च नोंदवा' : 'Expense'}
            </Button>
          </Link>
          <Link to="/sales/new">
            <Button size="sm" className="bg-brand-green hover:bg-brand-green-hover">
              <ShoppingBag className="w-4 h-4 mr-1" />
              {lang === 'mr' ? 'विक्री नोंदवा' : 'Sale'}
            </Button>
          </Link>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Main Profitability Hero Banner */}
      <Card
        className={`p-6 border-2 transition-all ${
          isProfit
            ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-white border-emerald-500/40'
            : 'bg-gradient-to-br from-rose-500/10 via-rose-50/50 to-white border-rose-500/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isProfit ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                }`}
              >
                {isProfit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {lang === 'mr' ? 'एकूण शेती नफा / तोटा (हिशोब)' : 'Net Farm Profit / Loss (Accrual)'}
              </span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span
                className={`text-3xl sm:text-4xl font-extrabold ${
                  isProfit ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCurrency(Math.abs(summary.netProfitPaise), lang)}
              </span>
              <span className="text-sm font-semibold text-slate-600">
                {isProfit ? (lang === 'mr' ? '(निव्वळ नफा)' : '(Net Profit)') : (lang === 'mr' ? '(तोटा)' : '(Loss)')}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {lang === 'mr'
                ? `एकूण विक्री (${formatCurrency(summary.totalSalesPaise, lang)}) मधून एकूण खर्च (${formatCurrency(summary.totalExpensesPaise, lang)}) वजा करून`
                : `Calculated from Total Sales (${formatCurrency(summary.totalSalesPaise, lang)}) minus Total Expenses (${formatCurrency(summary.totalExpensesPaise, lang)})`}
            </p>
          </div>

          <div className="flex sm:flex-col gap-4 text-right border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-3 sm:pt-0 sm:pl-6">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                {lang === 'mr' ? 'एकूण विक्री' : 'Total Sales'}
              </span>
              <span className="text-lg font-bold text-emerald-700">
                {formatCurrency(summary.totalSalesPaise, lang)}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                {lang === 'mr' ? 'एकूण खर्च' : 'Total Expenses'}
              </span>
              <span className="text-lg font-bold text-rose-700">
                {formatCurrency(summary.totalExpensesPaise, lang)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Cash Flow vs Receivables/Payables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Realized Cash Flow Card */}
        <Card className="p-5 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wallet className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                {lang === 'mr' ? 'रोख आवक-जावक (Cash Flow)' : 'Realized Cash Flow'}
              </h3>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                isPositiveCashFlow ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isPositiveCashFlow ? '+' : '-'} {formatCurrency(Math.abs(summary.netCashFlowPaise), lang)}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {lang === 'mr'
              ? 'प्रत्यक्षात हातात आलेले व दिलेले पैसे (उधारी वगळून)'
              : 'Actual cash/UPI received and paid out (excluding credit)'}
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <span className="text-[11px] text-emerald-800 block font-medium flex items-center">
                <ArrowDownLeft className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                {lang === 'mr' ? 'रोख आवक' : 'Cash Inflow'}
              </span>
              <span className="text-base font-bold text-emerald-700 block mt-0.5">
                {formatCurrency(summary.cashInflowPaise, lang)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-100">
              <span className="text-[11px] text-rose-800 block font-medium flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-rose-600" />
                {lang === 'mr' ? 'रोख जावक' : 'Cash Outflow'}
              </span>
              <span className="text-base font-bold text-rose-700 block mt-0.5">
                {formatCurrency(summary.cashOutflowPaise, lang)}
              </span>
            </div>
          </div>
        </Card>

        {/* Pending Dues (Receivables & Payables) */}
        <Card className="p-5 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                {lang === 'mr' ? 'उधारी व देणे-घेणे' : 'Receivables & Payables'}
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {lang === 'mr'
              ? 'व्यापाऱ्यांकडून येणे बाकी आणि दुकानदारांना देणे बाकी'
              : 'Outstanding money owed to you and money you owe'}
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
              <span className="text-[11px] text-amber-800 block font-medium">
                {lang === 'mr' ? 'व्यापाऱ्यांकडे बाकी (येणे)' : 'Receivables (Due to You)'}
              </span>
              <span className="text-base font-bold text-amber-700 block mt-0.5">
                {formatCurrency(summary.receivablesPaise, lang)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-600 block font-medium">
                {lang === 'mr' ? 'खर्चाची उधारी (देणे)' : 'Payables (You Owe)'}
              </span>
              <span className="text-base font-bold text-slate-700 block mt-0.5">
                {formatCurrency(summary.payablesPaise, lang)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Category-wise Expense Breakdown */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PieChart className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {lang === 'mr' ? 'प्रवर्ग निहाय खर्च विभागणी' : 'Category-wise Expense Breakdown'}
            </h3>
          </div>
          <Link to="/expenses" className="text-xs text-brand-green font-semibold hover:underline">
            {lang === 'mr' ? 'सर्व खर्च पहा' : 'View All'}
          </Link>
        </div>

        {summary.categoryBreakdown && summary.categoryBreakdown.length > 0 ? (
          <div className="space-y-3">
            {summary.categoryBreakdown.map((cat) => {
              const percent =
                summary.totalExpensesPaise > 0
                  ? Math.round((cat.totalPaise / summary.totalExpensesPaise) * 100)
                  : 0;
              return (
                <div key={cat.categoryId} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center font-medium">
                    <span className="text-slate-800">
                      {lang === 'mr' ? cat.nameMr : cat.nameEn} ({cat.count} {lang === 'mr' ? 'नोंदी' : 'records'})
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(cat.totalPaise, lang)}{' '}
                      <span className="text-slate-400 font-normal">({percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-2">
            {lang === 'mr' ? 'कोणतीही खर्च नोंद आढळली नाही.' : 'No expense records found.'}
          </p>
        )}
      </Card>

      {/* Quick Nav Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/expenses">
          <Card className="p-4 hover:border-brand-green transition-all flex items-center justify-between group">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  {lang === 'mr' ? 'खर्च नोंदवही' : 'Expenses'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {lang === 'mr' ? 'खर्च, बिले आणि वाटप' : 'Bills and allocations'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-green group-hover:translate-x-0.5 transition-all" />
          </Card>
        </Link>

        <Link to="/harvests">
          <Card className="p-4 hover:border-brand-green transition-all flex items-center justify-between group">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Wheat className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  {lang === 'mr' ? 'काढणी साठा' : 'Harvest Stock'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {lang === 'mr' ? 'उत्पादन व शिल्लक धान्य' : 'Yields and inventory'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-green group-hover:translate-x-0.5 transition-all" />
          </Card>
        </Link>

        <Link to="/sales">
          <Card className="p-4 hover:border-brand-green transition-all flex items-center justify-between group">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  {lang === 'mr' ? 'विक्री आवक' : 'Sales & Inward'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {lang === 'mr' ? 'बाजारभाव व उधारी' : 'Produce sales and dues'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-green group-hover:translate-x-0.5 transition-all" />
          </Card>
        </Link>
      </div>
    </div>
  );
};
