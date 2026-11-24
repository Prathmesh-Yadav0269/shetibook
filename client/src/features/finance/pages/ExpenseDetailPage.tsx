import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { Expense } from '../types';
import { PaymentModal } from '../components/PaymentModal';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { formatCurrency } from '../../../utils/finance';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Building,
  User,
  Calendar,
} from 'lucide-react';

export const ExpenseDetailPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [expense, setExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const fetchExpense = useCallback(async () => {
    if (!selectedGroup || !expenseId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await financeApi.getExpense(selectedGroup.id, expenseId);
      setExpense(res);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'खर्च माहिती लोड करता आली नाही');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup, expenseId]);

  useEffect(() => {
    fetchExpense();
  }, [fetchExpense]);

  const handleDelete = async () => {
    if (!selectedGroup || !expenseId) return;
    const confirmMsg =
      lang === 'mr'
        ? 'तुम्हाला खात्री आहे का हा खर्च हटवायचा आहे?'
        : 'Are you sure you want to delete this expense?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsDeleting(true);
      await financeApi.deleteExpense(selectedGroup.id, expenseId);
      navigate('/expenses');
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'खर्च हटवता आला नाही');
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
      fetchExpense();
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

  if (!expense) {
    return (
      <Card className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-2" />
        <h3 className="font-semibold text-slate-800">{lang === 'mr' ? 'खर्च आढळला नाही' : 'Expense Not Found'}</h3>
        <Link to="/expenses" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            {lang === 'mr' ? 'खर्च यादीकडे जा' : 'Back to Expenses'}
          </Button>
        </Link>
      </Card>
    );
  }

  const getStatusBadge = (status: Expense['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            {lang === 'mr' ? 'पूर्ण भरले (Paid)' : 'Paid'}
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3.5 h-3.5 mr-1" />
            {lang === 'mr' ? 'अंशतः भरले (Partially Paid)' : 'Partially Paid'}
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            {lang === 'mr' ? 'बाकी (Unpaid)' : 'Unpaid'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/expenses"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {lang === 'mr' ? expense.categoryNameMr : expense.categoryNameEn}
              </h1>
              {getStatusBadge(expense.paymentStatus)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {expense.farmName} • {expense.expenseDate}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {expense.balancePaise > 0 && (
            <Button
              onClick={() => setIsPaymentModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-sm"
            >
              <CreditCard className="w-4 h-4 mr-1.5" />
              {lang === 'mr' ? 'पेमेंट नोंदवा' : 'Record Payment'}
            </Button>
          )}

          <Link to={`/expenses/${expense.id}/edit`}>
            <Button variant="outline" size="md">
              <Edit2 className="w-4 h-4 mr-1" />
              {lang === 'mr' ? 'दुरुस्त करा' : 'Edit'}
            </Button>
          </Link>

          <Button variant="danger" size="md" onClick={handleDelete} isLoading={isDeleting}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-50 border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'एकूण खर्च' : 'Total Expense'}
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {formatCurrency(expense.amountPaise, lang)}
          </span>
        </Card>

        <Card className="bg-emerald-50/50 border-emerald-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'भरलेली रक्कम' : 'Paid Amount'}
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            {formatCurrency(expense.paidPaise, lang)}
          </span>
        </Card>

        <Card className="bg-amber-50/50 border-amber-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'शिल्लक बाकी' : 'Balance Remaining'}
          </span>
          <span className="text-2xl font-bold text-amber-700 mt-1 block">
            {formatCurrency(expense.balancePaise, lang)}
          </span>
        </Card>
      </div>

      {/* Description / Metadata */}
      <Card className="p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">{lang === 'mr' ? 'तपशील' : 'Details'}</h3>
        {expense.description ? (
          <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
            {expense.description}
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic">
            {lang === 'mr' ? 'कोणताही तपशील दिलेला नाही' : 'No description provided'}
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-500 border-t border-slate-100">
          <div className="flex items-center space-x-1.5">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <span>{expense.farmName}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{expense.expenseDate}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{expense.createdByName}</span>
          </div>
        </div>
      </Card>

      {/* Crop Allocations Breakdown */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {lang === 'mr' ? 'पीक निहाय खर्च वाटप' : 'Crop Allocations Breakdown'}
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {expense.allocations?.length || 0} {lang === 'mr' ? 'पिके' : 'crops'}
          </span>
        </div>

        <div className="space-y-2">
          {expense.allocations && expense.allocations.length > 0 ? (
            expense.allocations.map((alloc) => (
              <div
                key={alloc.id}
                className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/40 border border-emerald-100 text-xs sm:text-sm"
              >
                <div>
                  <span className="font-bold text-slate-800 block">{alloc.cropName}</span>
                  <span className="text-slate-500 text-xs">{alloc.plotName}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-700 block">
                    {formatCurrency(alloc.amountPaise, lang)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {Math.round((alloc.amountPaise / expense.amountPaise) * 100)}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic py-2">
              {lang === 'mr'
                ? 'कोणत्याही विशिष्ट पिकाला वाटप केलेले नाही. संपूर्ण खर्च सामान्य शेत खर्च मानला गेला आहे.'
                : 'No specific crop allocation. Full amount considered general farm expense.'}
            </p>
          )}

          {expense.unallocatedPaise > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm">
              <div>
                <span className="font-bold text-slate-800 block">
                  {lang === 'mr' ? 'सामान्य शेत खर्च (न वाटलेला)' : 'General Farm Cost (Unallocated)'}
                </span>
                <span className="text-slate-500 text-xs">{expense.farmName}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-700 block">
                  {formatCurrency(expense.unallocatedPaise, lang)}
                </span>
                <span className="text-[11px] text-slate-400">
                  {Math.round((expense.unallocatedPaise / expense.amountPaise) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Payment History */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {lang === 'mr' ? 'पेमेंट इतिहास' : 'Payment History'}
            </h3>
          </div>
          {expense.balancePaise > 0 && (
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="text-xs text-brand-green font-semibold hover:underline flex items-center"
            >
              + {lang === 'mr' ? 'पेमेंट जोडा' : 'Add Payment'}
            </button>
          )}
        </div>

        {expense.payments && expense.payments.length > 0 ? (
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
                {expense.payments.map((p) => (
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
              ? 'या खर्चावर अद्याप कोणतेही पेमेंट नोंदवलेले नाही.'
              : 'No payment recorded yet for this expense.'}
          </p>
        )}
      </Card>

      {/* Payment Modal */}
      {selectedGroup && (
        <PaymentModal
          groupId={selectedGroup.id}
          expenseId={expense.id}
          title={lang === 'mr' ? 'खर्चासाठी पेमेंट नोंदवा' : 'Record Payment for Expense'}
          totalPaise={expense.amountPaise}
          paidPaise={expense.paidPaise}
          balancePaise={expense.balancePaise}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={fetchExpense}
        />
      )}
    </div>
  );
};
