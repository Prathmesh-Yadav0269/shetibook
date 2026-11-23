import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../../app/providers/AuthProvider';
import { agricultureApi } from '../services/agricultureApi';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { ArrowLeft, Info } from 'lucide-react';
import { Farm, Plot, CropType, CropSeason } from '../types';

const cropFormSchema = z.object({
  farmId: z.string().min(1, 'कृपया शेत निवडा'),
  plotId: z.string().min(1, 'कृपया तुकडा / प्लॉट निवडा'),
  cropTypeId: z.string().min(1, 'पिकाचा प्रकार निवडा'),
  cropSeasonId: z.string().min(1, 'हंगाम निवडा'),
  cropNameCustom: z.string().trim().max(100).optional(),
  sowingDate: z.string().min(10, 'पेरणी तारीख आवश्यक आहे'),
  expectedHarvestDate: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

type CropFormData = z.infer<typeof cropFormSchema>;

export const CropFormPage: React.FC = () => {
  const { cropId } = useParams<{ cropId?: string }>();
  const [searchParams] = useSearchParams();
  const initialFarmId = searchParams.get('farmId') || '';
  const initialPlotId = searchParams.get('plotId') || '';
  const isEdit = !!cropId;

  const navigate = useNavigate();
  const { selectedGroup } = useAuth();
  const groupId = selectedGroup?.id;

  const [farms, setFarms] = useState<Farm[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [cropTypes, setCropTypes] = useState<CropType[]>([]);
  const [cropSeasons, setCropSeasons] = useState<CropSeason[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CropFormData>({
    resolver: zodResolver(cropFormSchema),
    defaultValues: {
      farmId: initialFarmId,
      plotId: initialPlotId,
      sowingDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedFarmId = watch('farmId');
  const selectedPlotId = watch('plotId');
  const selectedPlot = plots.find((p) => p.id === selectedPlotId);

  useEffect(() => {
    if (groupId) {
      Promise.all([
        agricultureApi.getFarms(groupId),
        agricultureApi.getCropMetadata(groupId),
      ])
        .then(([farmsData, meta]) => {
          setFarms(farmsData);
          setCropTypes(meta.cropTypes);
          setCropSeasons(meta.cropSeasons);

          if (initialFarmId) {
            agricultureApi.getPlots(groupId, initialFarmId).then(setPlots);
          }

          if (isEdit && cropId) {
            return agricultureApi.getCrop(groupId, cropId).then((crop) => {
              agricultureApi.getPlots(groupId, crop.farmId).then(setPlots);
              reset({
                farmId: crop.farmId,
                plotId: crop.plotId,
                cropTypeId: crop.cropTypeId,
                cropSeasonId: crop.cropSeasonId,
                cropNameCustom: crop.cropNameCustom || '',
                sowingDate: crop.sowingDate,
                expectedHarvestDate: crop.expectedHarvestDate || '',
                notes: crop.notes || '',
              });
            });
          }
        })
        .catch(() => setServerError('माहिती लोड करण्यात त्रुटी आली.'))
        .finally(() => setLoadingInitial(false));
    }
  }, [groupId, initialFarmId, isEdit, cropId, reset]);

  // When selected farm changes, update available plots
  useEffect(() => {
    if (groupId && selectedFarmId && !isEdit) {
      agricultureApi.getPlots(groupId, selectedFarmId).then((plotsData) => {
        setPlots(plotsData);
        if (!plotsData.some((p) => p.id === selectedPlotId)) {
          setValue('plotId', plotsData[0]?.id || '');
        }
      });
    }
  }, [groupId, selectedFarmId, setValue, isEdit, selectedPlotId]);

  const onSubmit = async (data: CropFormData) => {
    if (!groupId) return;
    setServerError(null);

    try {
      if (isEdit && cropId) {
        await agricultureApi.updateCrop(groupId, cropId, {
          cropNameCustom: data.cropNameCustom,
          sowingDate: data.sowingDate,
          expectedHarvestDate: data.expectedHarvestDate || null,
          notes: data.notes,
        });
        navigate(`/crops/${cropId}`);
      } else {
        const created = await agricultureApi.createCrop(groupId, {
          farmId: data.farmId,
          plotId: data.plotId,
          cropTypeId: data.cropTypeId,
          cropSeasonId: data.cropSeasonId,
          cropNameCustom: data.cropNameCustom,
          sowingDate: data.sowingDate,
          expectedHarvestDate: data.expectedHarvestDate || null,
          notes: data.notes,
        });
        navigate(`/crops/${created.id}`);
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
          to={isEdit && cropId ? `/crops/${cropId}` : '/crops'}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isEdit ? 'पिकाच्या माहितीत बदल करा' : 'नवीन पीक नोंदवा'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            {selectedGroup?.name} — पेरणी, हंगाम व पिकांची नोंदणी
          </p>
        </div>
      </div>

      {serverError && <Alert variant="error">{serverError}</Alert>}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Farm and Plot Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                शेत निवडा *
              </label>
              <select
                disabled={isEdit}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green disabled:bg-slate-100"
                {...register('farmId')}
              >
                <option value="">-- शेत निवडा --</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.farmName} ({f.village})
                  </option>
                ))}
              </select>
              {errors.farmId && (
                <p className="text-xs text-red-600 mt-1">{errors.farmId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                तुकडा / प्लॉट निवडा *
              </label>
              <select
                disabled={isEdit || plots.length === 0}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green disabled:bg-slate-100"
                {...register('plotId')}
              >
                <option value="">-- प्लॉट निवडा --</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plotName} ({p.cultivationMode === 'intercropping' ? 'आंतरपीक' : 'स्वतंत्र'})
                  </option>
                ))}
              </select>
              {errors.plotId && (
                <p className="text-xs text-red-600 mt-1">{errors.plotId.message}</p>
              )}
            </div>
          </div>

          {/* Plot Cultivation Mode Notice */}
          {selectedPlot && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${
                selectedPlot.cultivationMode === 'intercropping'
                  ? 'bg-purple-50 text-purple-900 border-purple-200'
                  : 'bg-blue-50 text-blue-900 border-blue-200'
              }`}
            >
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                हा प्लॉट{' '}
                <strong>
                  {selectedPlot.cultivationMode === 'intercropping'
                    ? 'आंतरपीक (Intercropping)'
                    : 'स्वतंत्र पीक (Separate)'}
                </strong>{' '}
                मोडमध्ये आहे.
                {selectedPlot.cultivationMode === 'separate' &&
                  ' स्वतंत्र मोडमध्ये एका वेळी एकच सक्रिय पीक ठेवता येते.'}
                {selectedPlot.cultivationMode === 'intercropping' &&
                  ' आंतरपीक मोडमध्ये एकाच क्षेत्रात अनेक पिके एकत्र नोंदवता येतात.'}
              </span>
            </div>
          )}

          {/* Crop Type and Season */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                पिकाचा प्रकार *
              </label>
              <select
                disabled={isEdit}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green disabled:bg-slate-100"
                {...register('cropTypeId')}
              >
                <option value="">-- पीक निवडा --</option>
                {cropTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.nameMr} ({ct.nameEn})
                  </option>
                ))}
              </select>
              {errors.cropTypeId && (
                <p className="text-xs text-red-600 mt-1">{errors.cropTypeId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                हंगाम (Season) *
              </label>
              <select
                disabled={isEdit}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green disabled:bg-slate-100"
                {...register('cropSeasonId')}
              >
                <option value="">-- हंगाम निवडा --</option>
                {cropSeasons.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.nameMr} ({cs.nameEn})
                  </option>
                ))}
              </select>
              {errors.cropSeasonId && (
                <p className="text-xs text-red-600 mt-1">{errors.cropSeasonId.message}</p>
              )}
            </div>
          </div>

          {/* Custom Name / Variety */}
          <Input
            label="वाण / पिकाचे विशेष नाव (ऐच्छिक)"
            placeholder="उदा. को ८६०३२, शरबती गहू, फुले कल्याणी"
            error={errors.cropNameCustom?.message}
            {...register('cropNameCustom')}
          />

          {/* Sowing and Expected Harvest Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="पेरणी / लागवड तारीख *"
              type="date"
              error={errors.sowingDate?.message}
              {...register('sowingDate')}
            />

            <Input
              label="अपेक्षित काढणी तारीख (ऐच्छिक)"
              type="date"
              error={errors.expectedHarvestDate?.message}
              {...register('expectedHarvestDate')}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              टीप (ऐच्छिक)
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green"
              placeholder="उदा. बेणे प्रक्रिया केली, घरचे बियाणे..."
              {...register('notes')}
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center space-x-3">
            <Button type="submit" variant="primary" className="flex-1" isLoading={isSubmitting}>
              {isEdit ? 'बदल सेव्ह करा' : 'पीक नोंदवा'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(isEdit && cropId ? `/crops/${cropId}` : '/crops')}
            >
              रद्द करा
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
