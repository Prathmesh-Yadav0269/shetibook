import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { agricultureApi } from '../../agriculture/services/agricultureApi';
import { Farm, Crop } from '../../agriculture/types';
import { HarvestUnit } from '../../../utils/finance';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Alert } from '../../../components/ui/Alert';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export const HarvestFormPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const { harvestId } = useParams<{ harvestId: string }>();
  const isEditing = Boolean(harvestId);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [farms, setFarms] = useState<Farm[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  const [farmId, setFarmId] = useState('');
  const [cropId, setCropId] = useState('');
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<HarvestUnit>('quintal');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      const farmRes = await agricultureApi.getFarms(selectedGroup.id);
      setFarms(farmRes || []);

      if (farmRes?.length && !farmId) {
        setFarmId(farmRes[0].id);
      }

      if (isEditing && harvestId) {
        const h = await financeApi.getHarvest(selectedGroup.id, harvestId);
        setFarmId(h.farmId);
        setCropId(h.cropId);
        setHarvestDate(h.harvestDate);
        setQuantity(h.quantity.toString());
        setUnit(h.unit);
        setNotes(h.notes || '');
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'माहिती आणता आली नाही');
    }
  }, [selectedGroup, isEditing, harvestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load crops when farm changes
  useEffect(() => {
    if (!selectedGroup || !farmId) return;
    agricultureApi.getCrops(selectedGroup.id, { farmId }).then((res) => {
      setCrops(res || []);
      if (res?.length && !isEditing) {
        setCropId(res[0].id);
      }
    });
  }, [selectedGroup, farmId, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    setError(null);

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError(lang === 'mr' ? 'कृपया सकारात्मक उत्पादन प्रमाण प्रविष्ट करा' : 'Please enter a positive harvest quantity');
      return;
    }

    try {
      setIsSaving(true);
      if (isEditing && harvestId) {
        await financeApi.updateHarvest(selectedGroup.id, harvestId, {
          harvestDate,
          quantity: qty,
          unit,
          notes: notes.trim() || null,
        });
      } else {
        await financeApi.createHarvest(selectedGroup.id, {
          farmId,
          cropId,
          harvestDate,
          quantity: qty,
          unit,
          notes: notes.trim() || null,
        });
      }

      navigate('/harvests');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(errObj.response?.data?.error?.message || errObj.message || 'काढणी नोंदवता आली नाही');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Link
          to="/harvests"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing
              ? lang === 'mr'
                ? 'काढणी माहिती दुरुस्त करा'
                : 'Edit Harvest'
              : lang === 'mr'
              ? 'नवीन काढणी नोंदवा'
              : 'Record Harvest'}
          </h1>
          <p className="text-xs text-slate-500">
            {lang === 'mr' ? 'पिकाचे उत्पादन, वजन व दिनांक नोंदवा' : 'Enter crop harvest yield and date'}
          </p>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {lang === 'mr' ? 'शेत निवडा *' : 'Select Farm *'}
            </label>
            <select
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              disabled={isEditing}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green disabled:bg-slate-100"
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
              disabled={isEditing}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green disabled:bg-slate-100"
              required
            >
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cropNameCustom || c.cropNameMr || c.cropNameEn} ({c.plotName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={lang === 'mr' ? 'काढणी दिनांक *' : 'Harvest Date *'}
              type="date"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {lang === 'mr' ? 'उत्पादन प्रमाण व एकक *' : 'Quantity & Unit *'}
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="उदा. 15"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
                  required
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as HarvestUnit)}
                  className="w-28 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green"
                >
                  <option value="quintal">{lang === 'mr' ? 'क्विंटल' : 'Quintal'}</option>
                  <option value="kg">{lang === 'mr' ? 'किलो' : 'Kg'}</option>
                  <option value="tonne">{lang === 'mr' ? 'टन' : 'Tonne'}</option>
                </select>
              </div>
            </div>
          </div>

          <Input
            label={lang === 'mr' ? 'नोंद / टीप (ऐच्छिक)' : 'Notes / Remarks (Optional)'}
            type="text"
            placeholder="उदा. पहिली तोडणी, उच्च दर्जा"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <Link to="/harvests">
              <Button type="button" variant="outline" disabled={isSaving}>
                {lang === 'mr' ? 'रद्द करा' : 'Cancel'}
              </Button>
            </Link>
            <Button type="submit" isLoading={isSaving}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {isEditing
                ? lang === 'mr'
                  ? 'बदल जतन करा'
                  : 'Save Changes'
                : lang === 'mr'
                ? 'काढणी जतन करा'
                : 'Save Harvest'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
