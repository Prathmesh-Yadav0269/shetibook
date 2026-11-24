import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Alert } from '../../../components/ui/Alert';
import { financeApi } from '../services/financeApi';
import { formatCurrency, fromPaise, toPaise, PaymentMethod } from '../../../utils/finance';
import { X, CreditCard, CheckCircle2 } from 'lucide-react';

interface PaymentModalProps {
  groupId: string;
  expenseId?: string;
  saleId?: string;
  title: string;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  groupId,
  expenseId,
  saleId,
  title,
  totalPaise,
  paidPaise,
  balancePaise,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [amountRupees, setAmountRupees] = useState<string>(fromPaise(balancePaise).toString());
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setError(lang === 'mr' ? 'कृपया वैध व सकारात्मक रक्कम टाका' : 'Please enter a valid positive amount');
      return;
    }

    const amountPaise = toPaise(rupees);
    if (amountPaise > balancePaise) {
      setError(
        lang === 'mr'
          ? `पेमेंट शिल्लक रक्कमेपेक्षा (${formatCurrency(balancePaise, lang)}) जास्त असू शकत नाही`
          : `Payment cannot exceed outstanding balance (${formatCurrency(balancePaise, lang)})`
      );
      return;
    }

    try {
      setIsLoading(true);
      await financeApi.recordPayment(groupId, {
        expenseId: expenseId || null,
        saleId: saleId || null,
        amountPaise,
        paymentDate,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(errObj.response?.data?.error?.message || errObj.message || 'पेमेंट नोंदवता आले नाही');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Overview */}
        <div className="bg-emerald-50/50 p-4 border-b border-emerald-100 flex items-center justify-between text-xs sm:text-sm">
          <div>
            <span className="text-slate-500 block">{lang === 'mr' ? 'एकूण रक्कम' : 'Total Amount'}</span>
            <span className="font-semibold text-slate-800">{formatCurrency(totalPaise, lang)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{lang === 'mr' ? 'आधी दिलेले' : 'Paid'}</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(paidPaise, lang)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{lang === 'mr' ? 'शिल्लक बाकी' : 'Balance'}</span>
            <span className="font-bold text-amber-600">{formatCurrency(balancePaise, lang)}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <Input
            label={lang === 'mr' ? 'पेमेंट रक्कम (रु.) *' : 'Payment Amount (₹) *'}
            type="number"
            step="0.01"
            min="0.01"
            max={fromPaise(balancePaise)}
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
            required
            autoFocus
          />

          <Input
            label={lang === 'mr' ? 'पेमेंट तारीख *' : 'Payment Date *'}
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {lang === 'mr' ? 'पेमेंट पद्धत *' : 'Payment Method *'}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green"
              required
            >
              <option value="cash">{lang === 'mr' ? 'रोख (Cash)' : 'Cash'}</option>
              <option value="upi">{lang === 'mr' ? 'UPI (Google Pay / PhonePe)' : 'UPI'}</option>
              <option value="bank_transfer">{lang === 'mr' ? 'बँक ट्रान्सफर / चेक' : 'Bank Transfer / Cheque'}</option>
              <option value="credit">{lang === 'mr' ? 'उधारी / क्रेडिट (Credit)' : 'Credit'}</option>
              <option value="other">{lang === 'mr' ? 'इतर (Other)' : 'Other'}</option>
            </select>
          </div>

          <Input
            label={lang === 'mr' ? 'संदर्भ / ट्रॅन्झॅक्शन क्र. (ऐच्छिक)' : 'Reference / UTR No. (Optional)'}
            type="text"
            placeholder="उदा. UPI-123456 किंवा चेक क्र."
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />

          <Input
            label={lang === 'mr' ? 'नोंद / टीप (ऐच्छिक)' : 'Notes (Optional)'}
            type="text"
            placeholder="उदा. दुकानदार पावती क्र."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex items-center justify-end space-x-3 pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {lang === 'mr' ? 'रद्द करा' : 'Cancel'}
            </Button>
            <Button type="submit" isLoading={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {lang === 'mr' ? 'पेमेंट नोंदवा' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
