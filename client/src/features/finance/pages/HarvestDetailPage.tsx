import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { Harvest } from '../types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { formatCurrency, formatQuantity } from '../../../utils/finance';
import {
  ArrowLeft,
  Wheat,
  Edit2,
  Trash2,
  ShoppingBag,
} from 'lucide-react';

export const HarvestDetailPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const { harvestId } = useParams<{ harvestId: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [harvest, setHarvest] = useState<Harvest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchHarvest = useCallback(async () => {
    if (!selectedGroup || !harvestId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await financeApi.getHarvest(selectedGroup.id, harvestId);
      setHarvest(res);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'काढणी माहिती लोड करता आली नाही');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup, harvestId]);

  useEffect(() => {
    fetchHarvest();
  }, [fetchHarvest]);

  const handleDelete = async () => {
    if (!selectedGroup || !harvestId) return;
    const confirmMsg =
      lang === 'mr'
        ? 'तुम्हाला खात्री आहे का ही काढणी नोंद हटवायची आहे?'
        : 'Are you sure you want to delete this harvest record?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsDeleting(true);
      await financeApi.deleteHarvest(selectedGroup.id, harvestId);
      navigate('/harvests');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(errObj.response?.data?.error?.message || errObj.message || 'काढणी हटवता आली नाही');
    } finally {
      setIsDeleting(false);
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

  if (!harvest) {
    return (
      <Card className="text-center py-12">
        <Wheat className="w-12 h-12 text-slate-300 mx-auto mb-2" />
        <h3 className="font-semibold text-slate-800">{lang === 'mr' ? 'काढणी आढळली नाही' : 'Harvest Not Found'}</h3>
        <Link to="/harvests" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            {lang === 'mr' ? 'काढणी यादीकडे जा' : 'Back to Harvests'}
          </Button>
        </Link>
      </Card>
    );
  }

  const hasLinkedSales = Boolean(harvest.linkedSales && harvest.linkedSales.length > 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/harvests"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{harvest.cropName}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {harvest.farmName} • {harvest.plotName} • {harvest.harvestDate}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {harvest.remainingQuantity > 0 && (
            <Link to={`/sales/new?harvestId=${harvest.id}`}>
              <Button className="bg-brand-green hover:bg-brand-green-hover shadow-sm">
                <ShoppingBag className="w-4 h-4 mr-1.5" />
                {lang === 'mr' ? 'या काढणीतून विक्री करा' : 'Sell from Harvest'}
              </Button>
            </Link>
          )}

          <Link to={`/harvests/${harvest.id}/edit`}>
            <Button variant="outline" size="md">
              <Edit2 className="w-4 h-4 mr-1" />
              {lang === 'mr' ? 'दुरुस्त करा' : 'Edit'}
            </Button>
          </Link>

          <Button
            variant="danger"
            size="md"
            onClick={handleDelete}
            isLoading={isDeleting}
            disabled={hasLinkedSales}
            title={hasLinkedSales ? 'विक्री झालेल्या काढणी नोंदी हटवता येत नाहीत' : undefined}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Production / Inventory Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-50 border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'एकूण उत्पादन' : 'Total Harvest Yield'}
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {formatQuantity(harvest.quantity, harvest.unit, lang)}
          </span>
        </Card>

        <Card className="bg-amber-50/50 border-amber-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'विक्री झालेले प्रमाण' : 'Quantity Sold'}
          </span>
          <span className="text-2xl font-bold text-amber-700 mt-1 block">
            {formatQuantity(harvest.soldQuantity, harvest.unit, lang)}
          </span>
        </Card>

        <Card className="bg-emerald-50/50 border-emerald-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'शिल्लक उपलब्ध साठा' : 'Remaining Stock'}
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            {formatQuantity(harvest.remainingQuantity, harvest.unit, lang)}
          </span>
        </Card>
      </div>

      {/* Notes / Details */}
      {harvest.notes && (
        <Card className="p-4 space-y-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            {lang === 'mr' ? 'नोंद / टीप' : 'Notes'}
          </span>
          <p className="text-sm text-slate-700 italic">&quot;{harvest.notes}&quot;</p>
        </Card>
      )}

      {/* Linked Sales Table */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {lang === 'mr' ? 'संबंधित विक्री नोंदी' : 'Linked Sales History'}
            </h3>
          </div>
          {harvest.remainingQuantity > 0 && (
            <Link
              to={`/sales/new?harvestId=${harvest.id}`}
              className="text-xs text-brand-green font-semibold hover:underline flex items-center"
            >
              + {lang === 'mr' ? 'नवीन विक्री जोडा' : 'Add Sale'}
            </Link>
          )}
        </div>

        {harvest.linkedSales && harvest.linkedSales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">{lang === 'mr' ? 'विक्री तारीख' : 'Sale Date'}</th>
                  <th className="py-2.5 px-3">{lang === 'mr' ? 'विक्री प्रमाण' : 'Quantity'}</th>
                  <th className="py-2.5 px-3">{lang === 'mr' ? 'दर (प्रति एकक)' : 'Rate'}</th>
                  <th className="py-2.5 px-3">{lang === 'mr' ? 'एकूण रक्कम' : 'Total Amount'}</th>
                  <th className="py-2.5 px-3">{lang === 'mr' ? 'व्यापारी / खरेदीदार' : 'Buyer'}</th>
                  <th className="py-2.5 px-3 text-right">{lang === 'mr' ? 'पहा' : 'View'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {harvest.linkedSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{sale.saleDate}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {formatQuantity(sale.quantity, sale.unit, lang)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {formatCurrency(sale.ratePaise, lang)}/{sale.unit}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">
                      {formatCurrency(sale.totalAmountPaise, lang)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{sale.buyerName || '—'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        to={`/sales/${sale.id}`}
                        className="text-xs font-semibold text-brand-green hover:underline"
                      >
                        {lang === 'mr' ? 'तपशील' : 'View'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-2">
            {lang === 'mr'
              ? 'या काढणीतून अद्याप कोणतीही विक्री झालेली नाही.'
              : 'No produce sold yet from this harvest.'}
          </p>
        )}
      </Card>
    </div>
  );
};
