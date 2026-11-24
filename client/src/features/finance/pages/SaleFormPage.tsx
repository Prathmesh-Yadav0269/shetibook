import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { agricultureApi } from '../../agriculture/services/agricultureApi';
import { Harvest } from '../types';
import { Farm, Crop } from '../../agriculture/types';
import { HarvestUnit, toPaise, formatCurrency, formatQuantity } from '../../../utils/finance';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Alert } from '../../../components/ui/Alert';
import { ArrowLeft, ShoppingBag, Wheat, CheckCircle2 } from 'lucide-react';

export const SaleFormPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const [searchParams] = useSearchParams();
  const initialHarvestId = searchParams.get('harvestId') || '';
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [farms, setFarms] = useState<Farm[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);

  // Form mode: linked vs direct
  const [isLinkedToHarvest, setIsLinkedToHarvest] = useState<boolean>(Boolean(initialHarvestId));

  // Form values
  const [harvestId, setHarvestId] = useState<string>(initialHarvestId);
  const [farmId, setFarmId] = useState<string>('');
  const [cropId, setCropId] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<HarvestUnit>('quintal');
  const [rateRupees, setRateRupees] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      const [farmRes, hRes] = await Promise.all([
        agricultureApi.getFarms(selectedGroup.id),
        financeApi.getHarvests(selectedGroup.id),
      ]);
      setFarms(farmRes || []);
      const availableHarvests = (hRes || []).filter((h: Harvest) => h.remainingQuantity > 0 || h.id === initialHarvestId);
      setHarvests(availableHarvests);

      if (initialHarvestId) {
        const found = availableHarvests.find((h: Harvest) => h.id === initialHarvestId);
        if (found) {
          setHarvestId(found.id);
          setFarmId(found.farmId);
          setCropId(found.cropId);
          setUnit(found.unit);
          setQuantity(found.remainingQuantity.toString());
        }
      } else if (farmRes?.length) {
        setFarmId(farmRes[0].id);
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'माहिती लोड करता आली नाही');
    }
  }, [selectedGroup, initialHarvestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle harvest select change
  const handleHarvestSelect = (hId: string) => {
    setHarvestId(hId);
    const selected = harvests.find((h: Harvest) => h.id === hId);
    if (selected) {
      setFarmId(selected.farmId);
      setCropId(selected.cropId);
      setUnit(selected.unit);
      setQuantity(selected.remainingQuantity.toString());
    }
  };

  // Load crops for selected farm if in direct sale mode
  useEffect(() => {
    if (!selectedGroup || !farmId || isLinkedToHarvest) return;
    agricultureApi.getCrops(selectedGroup.id, { farmId }).then((res) => {
      setCrops(res || []);
      if (res?.length && !cropId) {
        setCropId(res[0].id);
      }
    });
  }, [selectedGroup, farmId, isLinkedToHarvest, cropId]);

  // Real-time calculation of total amount
  const qtyNum = parseFloat(quantity) || 0;
  const rateNum = parseFloat(rateRupees) || 0;
  const totalRupees = Math.round(qtyNum * rateNum * 100) / 100;

  const selectedHarvest = harvests.find((h) => h.id === harvestId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    setError(null);

    if (qtyNum <= 0) {
      setError(lang === 'mr' ? 'कृपया वैध विक्री प्रमाण टाका' : 'Please enter a valid quantity');
      return;
    }
    if (rateNum <= 0) {
      setError(lang === 'mr' ? 'कृपया वैध विक्री दर टाका' : 'Please enter a valid rate');
      return;
    }

    if (isLinkedToHarvest && selectedHarvest && qtyNum > selectedHarvest.remainingQuantity) {
      setError(
        lang === 'mr'
          ? `विक्री प्रमाण शिल्लक साठ्यापेक्षा (${formatQuantity(selectedHarvest.remainingQuantity, selectedHarvest.unit, lang)}) जास्त असू शकत नाही`
          : `Quantity cannot exceed remaining harvest stock (${formatQuantity(selectedHarvest.remainingQuantity, selectedHarvest.unit, lang)})`
      );
      return;
    }

    try {
      setIsSaving(true);
      await financeApi.createSale(selectedGroup.id, {
        farmId,
        cropId,
        harvestId: isLinkedToHarvest && harvestId ? harvestId : null,
        saleDate,
        quantity: qtyNum,
        unit,
        ratePaise: toPaise(rateNum),
        totalAmountPaise: toPaise(totalRupees),
        buyerName: buyerName.trim() || null,
        notes: notes.trim() || null,
      });

      navigate('/sales');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(errObj.response?.data?.error?.message || errObj.message || 'विक्री नोंदवता आली नाही');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Link
          to="/sales"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {lang === 'mr' ? 'नवीन शेतीमाल विक्री नोंदवा' : 'Record Produce Sale'}
          </h1>
          <p className="text-xs text-slate-500">
            {lang === 'mr'
              ? 'काढणीच्या साठ्यातून किंवा थेट शेतातून विक्री नोंदवा'
              : 'Record sales from existing harvest inventory or direct crop sales'}
          </p>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Linked to harvest toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {lang === 'mr' ? 'विक्रीचा प्रकार निवडा *' : 'Sale Type *'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsLinkedToHarvest(true);
                  if (harvests.length > 0 && !harvestId) {
                    handleHarvestSelect(harvests[0].id);
                  }
                }}
                className={`p-3 rounded-xl border text-left flex items-start space-x-2 transition-all ${
                  isLinkedToHarvest
                    ? 'border-brand-green bg-emerald-50/50 text-slate-900 ring-1 ring-brand-green'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Wheat className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-bold text-xs block">
                    {lang === 'mr' ? 'काढणीच्या साठ्यातून' : 'From Harvest Stock'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'mr' ? 'शिल्लक धान्यातून विक्री' : 'Deducts from harvest inventory'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsLinkedToHarvest(false);
                  setHarvestId('');
                }}
                className={`p-3 rounded-xl border text-left flex items-start space-x-2 transition-all ${
                  !isLinkedToHarvest
                    ? 'border-brand-green bg-emerald-50/50 text-slate-900 ring-1 ring-brand-green'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-bold text-xs block">
                    {lang === 'mr' ? 'थेट विक्री (Direct Sale)' : 'Direct Produce Sale'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'mr' ? 'काढणी नोंद न ठेवता थेट विक्री' : 'No harvest inventory deduction'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Harvest selector if linked */}
          {isLinkedToHarvest && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {lang === 'mr' ? 'काढणी निवडा (उपलब्ध साठा) *' : 'Select Harvest (Available Stock) *'}
              </label>
              {harvests.length > 0 ? (
                <select
                  value={harvestId}
                  onChange={(e) => handleHarvestSelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green font-medium"
                  required
                >
                  <option value="">{lang === 'mr' ? '-- काढणी निवडा --' : '-- Select Harvest --'}</option>
                  {harvests.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.cropName} ({h.farmName}) — शिल्लक साठा: {formatQuantity(h.remainingQuantity, h.unit, lang)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  {lang === 'mr'
                    ? 'विक्रीसाठी कोणतीही काढणी उपलब्ध नाही. कृपया आधी काढणी नोंदवा किंवा थेट विक्री पर्याय निवडा.'
                    : 'No harvest inventory available. Please record a harvest first or choose direct sale.'}
                </p>
              )}
            </div>
          )}

          {/* Farm and crop if direct */}
          {!isLinkedToHarvest && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {lang === 'mr' ? 'पीक निवडा *' : 'Select Crop *'}
                </label>
                <select
                  value={cropId}
                  onChange={(e) => setCropId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green"
                  required
                >
                  {crops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cropNameCustom || c.cropNameMr || c.cropNameEn} ({c.plotName})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Quantity, Unit, Rate, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {lang === 'mr' ? 'विक्री प्रमाण *' : 'Quantity *'}
              </label>
              <div className="flex space-x-1">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={isLinkedToHarvest && selectedHarvest ? selectedHarvest.remainingQuantity : undefined}
                  placeholder="उदा. 10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
                  required
                />
                {!isLinkedToHarvest ? (
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as HarvestUnit)}
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-medium"
                  >
                    <option value="quintal">{lang === 'mr' ? 'क्विंटल' : 'Quintal'}</option>
                    <option value="kg">{lang === 'mr' ? 'किलो' : 'Kg'}</option>
                    <option value="tonne">{lang === 'mr' ? 'टन' : 'Tonne'}</option>
                  </select>
                ) : (
                  <span className="inline-flex items-center px-2 py-2 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                    {unit}
                  </span>
                )}
              </div>
            </div>

            <Input
              label={lang === 'mr' ? `दर रु. (प्रति ${unit}) *` : `Rate ₹ (per ${unit}) *`}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="उदा. 2500"
              value={rateRupees}
              onChange={(e) => setRateRupees(e.target.value)}
              required
            />

            <Input
              label={lang === 'mr' ? 'विक्री तारीख *' : 'Sale Date *'}
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              required
            />
          </div>

          {/* Real-time total calculation badge */}
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-800 block font-semibold">
                {lang === 'mr' ? 'एकूण विक्री रक्कम (हिशोब)' : 'Total Sale Amount'}
              </span>
              <span className="text-xs text-slate-500">
                {qtyNum} {unit} × ₹{rateNum}
              </span>
            </div>
            <span className="text-2xl font-bold text-emerald-700">
              {formatCurrency(toPaise(totalRupees), lang)}
            </span>
          </div>

          {/* Buyer info */}
          <Input
            label={lang === 'mr' ? 'खरेदीदार / व्यापारी नाव (ऐच्छिक)' : 'Buyer / Trader Name (Optional)'}
            type="text"
            placeholder="उदा. रमेश अडत दुकान, मुंबई मार्केट"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
          />

          <Input
            label={lang === 'mr' ? 'नोंद / टीप (ऐच्छिक)' : 'Notes / Remarks (Optional)'}
            type="text"
            placeholder="उदा. गाडी क्रमांक, पावती क्र."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <Link to="/sales">
              <Button type="button" variant="outline" disabled={isSaving}>
                {lang === 'mr' ? 'रद्द करा' : 'Cancel'}
              </Button>
            </Link>
            <Button type="submit" isLoading={isSaving} disabled={qtyNum <= 0 || rateNum <= 0}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {lang === 'mr' ? 'विक्री जतन करा' : 'Save Sale'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
