import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { Sale } from '../types';
import { PaymentModal } from '../components/PaymentModal';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { formatCurrency, formatQuantity } from '../../../utils/finance';
import {
  ArrowLeft,
  ShoppingBag,
  Trash2,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wheat,
} from 'lucide-react';

export const SaleDetailPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const fetchSale = useCallback(async () => {
    if (!selectedGroup || !saleId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await financeApi.getSale(selectedGroup.id, saleId);
      setSale(res);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'विक्री माहिती लोड करता आली नाही');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup, saleId]);

  useEffect(() => {
    fetchSale();
  }, [fetchSale]);

  const handleDelete = async () => {
    if (!selectedGroup || !saleId) return;
    const confirmMsg =
      lang === 'mr'
        ? 'तुम्हाला खात्री आहे का ही विक्री नोंद हटवायची आहे?'
        : 'Are you sure you want to delete this sale record?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsDeleting(true);
      await financeApi.deleteSale(selectedGroup.id, saleId);
      navigate('/sales');
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'विक्री हटवता आली नाही');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!selectedGroup) return;
    const confirmMsg =
      lang === 'mr'
        ? 'हे पेमेंट हटवायचे आहे का?'
        : 'Are you sure you want to delete this payment?';
    if (!window.confirm(confirmMsg)) return;

    try {
      await financeApi.deletePayment(selectedGroup.id, paymentId);
      fetchSale();
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'पेमेंट हटवता आले नाही');
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-2">{lang === 'mr' ? 'माहिती लोड होत आहे...' : 'Loading...'}</p>
      </div>
    );
  }

  if (!sale) {
    return (
      <Card className="text-center py-12">
        <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-2" />
        <h3 className="font-semibold text-slate-800">{lang === 'mr' ? 'विक्री आढळली नाही' : 'Sale Not Found'}</h3>
        <Link to="/sales" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            {lang === 'mr' ? 'विक्री यादीकडे जा' : 'Back to Sales'}
          </Button>
        </Link>
      </Card>
    );
  }

  const getStatusBadge = (status: Sale['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            {lang === 'mr' ? 'पूर्ण जमा (Paid)' : 'Paid'}
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3.5 h-3.5 mr-1" />
            {lang === 'mr' ? 'अंशतः जमा (Partially Paid)' : 'Partially Paid'}
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            {lang === 'mr' ? 'उधारी बाकी (Due)' : 'Due'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/sales"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">{sale.cropName}</h1>
              {getStatusBadge(sale.paymentStatus)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {sale.farmName} • {sale.plotName} • {sale.saleDate}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {sale.balancePaise > 0 && (
            <Button
              onClick={() => setIsPaymentModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-sm"
            >
              <CreditCard className="w-4 h-4 mr-1.5" />
              {lang === 'mr' ? 'पैसे मिळाले (पेमेंट नोंदवा)' : 'Receive Payment'}
            </Button>
          )}

          <Button variant="danger" size="md" onClick={handleDelete} isLoading={isDeleting}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-50 border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'एकूण विक्री मूल्य' : 'Total Sale Value'}
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {formatCurrency(sale.totalAmountPaise, lang)}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {formatQuantity(sale.quantity, sale.unit, lang)} @ {formatCurrency(sale.ratePaise, lang)}/{sale.unit}
          </span>
        </Card>

        <Card className="bg-emerald-50/50 border-emerald-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'जमा झालेली रक्कम' : 'Received Amount'}
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            {formatCurrency(sale.paidPaise, lang)}
          </span>
        </Card>

        <Card className="bg-amber-50/50 border-amber-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'उधारी येणे बाकी' : 'Balance Receivable'}
          </span>
          <span className="text-2xl font-bold text-amber-700 mt-1 block">
            {formatCurrency(sale.balancePaise, lang)}
          </span>
        </Card>
      </div>

      {/* Details & Buyer info */}
      <Card className="p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">{lang === 'mr' ? 'विक्री तपशील' : 'Sale Details'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
          <div>
            <span className="text-slate-500 block text-xs">{lang === 'mr' ? 'व्यापारी / खरेदीदार' : 'Buyer'}</span>
            <span className="font-bold text-slate-800">{sale.buyerName || '—'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">{lang === 'mr' ? 'काढणी संदर्भ' : 'Harvest Reference'}</span>
            <span className="font-medium text-slate-800">
              {sale.harvestId ? (
                <Link
                  to={`/harvests/${sale.harvestId}`}
                  className="text-brand-green hover:underline flex items-center"
                >
                  <Wheat className="w-3.5 h-3.5 mr-1" />
                  {lang === 'mr' ? 'काढणी नोंद पहा' : 'View Harvest'}
                </Link>
              ) : (
                lang === 'mr' ? 'थेट विक्री (काढणी जोडलेली नाही)' : 'Direct Sale'
              )}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">{lang === 'mr' ? 'नोंदवणारे' : 'Recorded By'}</span>
            <span className="font-medium text-slate-800">{sale.createdByName}</span>
          </div>
        </div>

        {sale.notes && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500 block mb-1">{lang === 'mr' ? 'टीप / शेरा' : 'Notes'}</span>
            <p className="text-xs text-slate-700 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              {sale.notes}
            </p>
          </div>
        )}
      </Card>

      {/* Payment History */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {lang === 'mr' ? 'जमा झालेले पेमेंट (इतिहास)' : 'Received Payments History'}
            </h3>
          </div>
          {sale.balancePaise > 0 && (
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="text-xs text-brand-green font-semibold hover:underline flex items-center"
            >
              + {lang === 'mr' ? 'पेमेंट जमा नोंदवा' : 'Record Received Payment'}
            </button>
          )}
        </div>

        {sale.payments && sale.payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">{lang === 'mr' ? 'तारीख' : 'Date'}</th>
                  <th className="py-2.5 px-3">{lang === 'mr' ? 'पद्धत' : 'Method'}</th>
                  <th className="py-2.5 px-3">{lang === 'mr' ? 'रक्कम' : 'Amount'}</th>
                  <th className="py-2.5 px-3">{lang === 'mr' ? 'नोंद / संदर्भ' : 'Ref / Notes'}</th>
                  <th className="py-2.5 px-3 text-right">{lang === 'mr' ? 'क्रिया' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{p.paymentDate}</td>
                    <td className="py-2.5 px-3 uppercase text-xs font-semibold text-slate-600">
                      {p.paymentMethod}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">
                      {formatCurrency(p.amountPaise, lang)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {p.referenceNumber && (
                        <span className="font-mono text-xs block text-slate-700">{p.referenceNumber}</span>
                      )}
                      {p.notes && <span className="text-xs text-slate-500">{p.notes}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(p.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="पेमेंट हटवा"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-2">
            {lang === 'mr'
              ? 'या विक्रीपोटी अद्याप कोणतीही रक्कम जमा झालेली नाही.'
              : 'No payment received yet for this sale.'}
          </p>
        )}
      </Card>

      {/* Payment Modal */}
      {selectedGroup && (
        <PaymentModal
          groupId={selectedGroup.id}
          saleId={sale.id}
          title={lang === 'mr' ? 'विक्रीचे मिळालेले पैसे नोंदवा' : 'Record Received Payment'}
          totalPaise={sale.totalAmountPaise}
          paidPaise={sale.paidPaise}
          balancePaise={sale.balancePaise}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={fetchSale}
        />
      )}
    </div>
  );
};
