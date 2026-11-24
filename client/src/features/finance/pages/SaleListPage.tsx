import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { agricultureApi } from '../../agriculture/services/agricultureApi';
import { Sale } from '../types';
import { Farm } from '../../agriculture/types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { formatCurrency, formatQuantity } from '../../../utils/finance';
import {
  ShoppingBag,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  User,
} from 'lucide-react';

export const SaleListPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [sales, setSales] = useState<Sale[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const [sRes, farmRes] = await Promise.all([
        financeApi.getSales(selectedGroup.id, {
          farmId: selectedFarmId || undefined,
        }),
        agricultureApi.getFarms(selectedGroup.id),
      ]);
      setSales(sRes || []);
      setFarms(farmRes || []);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'विक्री नोंदी लोड करता आल्या नाहीत');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup, selectedFarmId]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Aggregate totals
  const totalSalesPaise = sales.reduce((sum, s) => sum + s.totalAmountPaise, 0);
  const totalPaidPaise = sales.reduce((sum, s) => sum + s.paidPaise, 0);
  const totalBalancePaise = sales.reduce((sum, s) => sum + s.balancePaise, 0);

  const getStatusBadge = (status: Sale['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {lang === 'mr' ? 'पूर्ण जमा' : 'Paid in Full'}
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            {lang === 'mr' ? 'अंशतः जमा' : 'Partially Paid'}
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            {lang === 'mr' ? 'उधारी बाकी' : 'Unpaid (Due)'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {lang === 'mr' ? 'उत्पादन विक्री व आवक नोंदवही' : 'Produce Sales Records'}
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {lang === 'mr'
              ? 'शेतीमालाची विक्री, व्यापारी, भाव, मिळालेले पैसे आणि उधारीचा हिशोब'
              : 'Track crop sales, buyer dues, incoming payments and receivables'}
          </p>
        </div>

        <Link to="/sales/new">
          <Button className="w-full sm:w-auto bg-brand-green hover:bg-brand-green-hover shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {lang === 'mr' ? 'नवीन विक्री नोंदवा' : 'Record Sale'}
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50/50 to-white border-emerald-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'एकूण विक्री मूल्य' : 'Total Sales Value'}
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {formatCurrency(totalSalesPaise, lang)}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {sales.length} {lang === 'mr' ? 'विक्री सौदे' : 'sales transactions'}
          </span>
        </Card>

        <Card className="bg-gradient-to-br from-teal-50/50 to-white border-teal-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'जमा झालेली रक्कम' : 'Received Payments'}
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            {formatCurrency(totalPaidPaise, lang)}
          </span>
          <span className="text-xs text-emerald-600 mt-1 block">
            {totalSalesPaise > 0 ? Math.round((totalPaidPaise / totalSalesPaise) * 100) : 0}%{' '}
            {lang === 'mr' ? 'वसूल' : 'realized'}
          </span>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50/50 to-white border-amber-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'व्यापाऱ्यांकडे बाकी (उधारी)' : 'Outstanding Receivables'}
          </span>
          <span className="text-2xl font-bold text-amber-700 mt-1 block">
            {formatCurrency(totalBalancePaise, lang)}
          </span>
          <span className="text-xs text-amber-600 mt-1 block">
            {sales.filter((s) => s.balancePaise > 0).length} {lang === 'mr' ? 'सौदे बाकी' : 'pending'}
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

      {/* Sales List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-2">{lang === 'mr' ? 'विक्री माहिती लोड होत आहे...' : 'Loading sales...'}</p>
        </div>
      ) : sales.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            {lang === 'mr' ? 'कोणतीही विक्री नोंदवलेली नाही' : 'No sales recorded yet'}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {lang === 'mr'
              ? 'धान्य, भाजीपाला किंवा फळे विक्रीची नोंद करा आणि कोणाकडून किती पैसे येणे आहे ते पहा.'
              : 'Record crop sales to keep track of buyers, rates and outstanding receivables.'}
          </p>
          <Link to="/sales/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {lang === 'mr' ? 'पहिली विक्री नोंदवा' : 'Record First Sale'}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <Link key={sale.id} to={`/sales/${sale.id}`}>
              <Card className="hover:border-slate-300 transition-all p-4 flex items-center justify-between group">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-base">{sale.cropName}</span>
                    {getStatusBadge(sale.paymentStatus)}
                    {sale.harvestId && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        {lang === 'mr' ? 'काढणीशी जोडलेली' : 'Harvest Linked'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {formatQuantity(sale.quantity, sale.unit, lang)} @ {formatCurrency(sale.ratePaise, lang)}/{sale.unit}
                    </span>
                    <span>•</span>
                    <span>{sale.saleDate}</span>
                    {sale.buyerName && (
                      <>
                        <span>•</span>
                        <span className="text-slate-700 font-medium flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {sale.buyerName}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-right">
                  <div>
                    <span className="font-bold text-slate-900 text-base block">
                      {formatCurrency(sale.totalAmountPaise, lang)}
                    </span>
                    {sale.balancePaise > 0 ? (
                      <span className="text-xs font-semibold text-amber-600 block">
                        {lang === 'mr' ? 'बाकी:' : 'Due:'} {formatCurrency(sale.balancePaise, lang)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-emerald-600 block">
                        {lang === 'mr' ? 'पूर्ण जमा' : 'Paid in Full'}
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
