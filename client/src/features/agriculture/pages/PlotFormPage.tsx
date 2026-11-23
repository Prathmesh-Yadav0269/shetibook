import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../../app/providers/AuthProvider';
import { agricultureApi } from '../services/agricultureApi';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { calculateAreaBreakdown, AreaUnit } from '../../../utils/area';
import { ArrowLeft, Calculator } from 'lucide-react';

const plotFormSchema = z.object({
  plotName: z.string().trim().min(1, 'तुकड्याचे / प्लॉटचे नाव आवश्यक आहे').max(100),
  areaValue: z.number({ invalid_type_error: 'क्षेत्र संख्या स्वरूपात टाका' }).positive('क्षेत्र ० पेक्षा जास्त असावे'),
  areaUnit: z.enum(['acre', 'guntha', 'hectare']),
  cultivationMode: z.enum(['separate', 'intercropping']),
  notes: z.string().trim().max(1000).optional(),
});

type PlotFormData = z.infer<typeof plotFormSchema>;

export const PlotFormPage: React.FC = () => {
  const { farmId, plotId } = useParams<{ farmId: string; plotId?: string }>();
  const isEdit = !!plotId;
  const navigate = useNavigate();
  const { selectedGroup } = useAuth();
  const groupId = selectedGroup?.id;

  const [farmName, setFarmName] = useState<string>('');
  const [unallocatedArea, setUnallocatedArea] = useState<number>(0);
  const [farmAreaUnit, setFarmAreaUnit] = useState<AreaUnit>('acre');
  const [serverError, setServerError] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlotFormData>({
    resolver: zodResolver(plotFormSchema),
    defaultValues: {
      areaUnit: 'acre',
      areaValue: 1,
      cultivationMode: 'separate',
    },
  });

  const watchedValue = watch('areaValue');
  const watchedUnit = watch('areaUnit') as AreaUnit;
  const areaBreakdown = calculateAreaBreakdown(Number(watchedValue) || 0, watchedUnit || 'acre');

  useEffect(() => {
    if (groupId && farmId) {
      agricultureApi
        .getFarm(groupId, farmId)
        .then((farm) => {
          setFarmName(farm.farmName);
          setUnallocatedArea(farm.unallocatedInUnit);
          setFarmAreaUnit(farm.areaUnit);

          if (isEdit && plotId) {
            return agricultureApi.getPlot(groupId, plotId).then((plot) => {
              reset({
                plotName: plot.plotName,
                areaValue: plot.areaValue,
                areaUnit: plot.areaUnit,
                cultivationMode: plot.cultivationMode,
                notes: plot.notes || '',
              });
            });
          }
        })
        .catch(() => setServerError('प्लॉट माहिती लोड करता आली नाही.'))
        .finally(() => setLoadingInitial(false));
    }
  }, [groupId, farmId, isEdit, plotId, reset]);

  const onSubmit = async (data: PlotFormData) => {
    if (!groupId || !farmId) return;
    setServerError(null);

    try {
      if (isEdit && plotId) {
        await agricultureApi.updatePlot(groupId, plotId, data);
        navigate(`/farms/${farmId}/plots/${plotId}`);
      } else {
        const created = await agricultureApi.createPlot(groupId, farmId, data);
        navigate(`/farms/${farmId}/plots/${created.id}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'त्रुटी आली. कृपया पुन्हा प्रयत्न करा.';
      setServerError(errorMsg);
    }
  };

  if (loadingInitial) {
    return (
      <div className="text-center py-16">
        <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Link
          to={`/farms/${farmId}`}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isEdit ? 'प्लॉटच्या माहितीत बदल करा' : 'नवीन तुकडा / प्लॉट जोडा'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            शेत: <span className="font-semibold text-slate-800">{farmName}</span>
          </p>
        </div>
      </div>

      {serverError && <Alert variant="error">{serverError}</Alert>}

      {/* Farm Remaining Area Info */}
      {!isEdit && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <span>या शेतात शिल्लक वाटप नसलेले क्षेत्र:</span>
          <span className="font-bold text-sm">
            {unallocatedArea} {farmAreaUnit === 'acre' ? 'एकर' : farmAreaUnit}
          </span>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Plot Name */}
          <Input
            label="तुकड्याचे / प्लॉटचे नाव *"
            placeholder="उदा. विहिरीचा तुकडा, प्लॉट नंबर १, बोरचा भाग"
            error={errors.plotName?.message}
            {...register('plotName')}
          />

          {/* Area Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-slate-800 font-semibold text-sm">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>प्लॉटचे क्षेत्रफळ *</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="क्षेत्र (Area Value)"
                type="number"
                step="any"
                placeholder="उदा. 1.5"
                error={errors.areaValue?.message}
                {...register('areaValue', { valueAsNumber: true })}
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  एकक (Unit)
                </label>
                <select
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green"
                  {...register('areaUnit')}
                >
                  <option value="acre">एकर (Acre)</option>
                  <option value="guntha">गुंठे (Guntha)</option>
                  <option value="hectare">हेक्टर (Hectare)</option>
                </select>
              </div>
            </div>

            {/* Live Breakdown */}
            {Number(watchedValue) > 0 && (
              <div className="mt-2 text-xs text-slate-600 font-mono bg-white p-2.5 rounded border border-slate-200 flex justify-around">
                <span>{areaBreakdown.acre} एकर</span>
                <span>•</span>
                <span>{areaBreakdown.guntha} गुंठे</span>
                <span>•</span>
                <span>{areaBreakdown.hectare} हेक्टर</span>
              </div>
            )}
          </div>

          {/* Cultivation Mode Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              लागवड पद्धत (Cultivation Mode) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3.5 border rounded-xl flex items-start space-x-3 cursor-pointer transition-all ${
                  watch('cultivationMode') === 'separate'
                    ? 'border-brand-green bg-emerald-50/40 ring-1 ring-brand-green'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  value="separate"
                  className="mt-1 text-brand-green focus:ring-brand-green"
                  {...register('cultivationMode')}
                />
                <div>
                  <span className="font-bold text-slate-900 text-sm block">
                    स्वतंत्र पीक (Separate)
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    या तुकड्यात एका वेळी एकच मुख्य पीक घेतले जाईल.
                  </p>
                </div>
              </label>

              <label
                className={`p-3.5 border rounded-xl flex items-start space-x-3 cursor-pointer transition-all ${
                  watch('cultivationMode') === 'intercropping'
                    ? 'border-purple-600 bg-purple-50/40 ring-1 ring-purple-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  value="intercropping"
                  className="mt-1 text-purple-600 focus:ring-purple-600"
                  {...register('cultivationMode')}
                />
                <div>
                  <span className="font-bold text-slate-900 text-sm block">
                    आंतरपीक (Intercropping)
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    एकाच तुकड्यात दोन किंवा अधिक पिके एकत्र घेतली जातील (उदा. ऊस + सोयाबीन).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              टीप / विशेष माहिती (ऐच्छिक)
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green"
              placeholder="उदा. ठिबक सिंचन सोय, काळी माती..."
              {...register('notes')}
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center space-x-3">
            <Button type="submit" variant="primary" className="flex-1" isLoading={isSubmitting}>
              {isEdit ? 'बदल सेव्ह करा' : 'प्लॉट तयार करा'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/farms/${farmId}`)}
            >
              रद्द करा
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
