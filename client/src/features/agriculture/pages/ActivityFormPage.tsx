import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../../app/providers/AuthProvider';
import { agricultureApi } from '../services/agricultureApi';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { ArrowLeft } from 'lucide-react';
import { Farm, Plot, Crop, ActivityType } from '../types';

const activityFormSchema = z.object({
  farmId: z.string().min(1, 'कृपया शेत निवडा'),
  plotId: z.string().optional().nullable(),
  cropId: z.string().optional().nullable(),
  activityTypeId: z.string().min(1, 'कामाचा प्रकार निवडा'),
  customActivityName: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional(),
});

type ActivityFormData = z.infer<typeof activityFormSchema>;

export const ActivityFormPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialFarmId = searchParams.get('farmId') || '';
  const initialCropId = searchParams.get('cropId') || '';

  const navigate = useNavigate();
  const { selectedGroup } = useAuth();
  const groupId = selectedGroup?.id;

  const [farms, setFarms] = useState<Farm[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      farmId: initialFarmId,
      cropId: initialCropId,
    },
  });

  const selectedFarmId = watch('farmId');

  useEffect(() => {
    if (groupId) {
      Promise.all([
        agricultureApi.getFarms(groupId),
        agricultureApi.getActivityTypes(groupId),
        agricultureApi.getCrops(groupId, { status: 'active' }),
      ])
        .then(([farmsData, types, activeCrops]) => {
          setFarms(farmsData);
          setActivityTypes(types);
          setCrops(activeCrops);

          if (initialFarmId) {
            agricultureApi.getPlots(groupId, initialFarmId).then(setPlots);
          }
        })
        .catch(() => setServerError('माहिती लोड करण्यात त्रुटी आली.'))
        .finally(() => setLoadingInitial(false));
    }
  }, [groupId, initialFarmId]);

  // When selected farm changes, update available plots and crops
  useEffect(() => {
    if (groupId && selectedFarmId) {
      agricultureApi.getPlots(groupId, selectedFarmId).then(setPlots);
      agricultureApi.getCrops(groupId, { farmId: selectedFarmId }).then(setCrops);
    }
  }, [groupId, selectedFarmId]);

  const onSubmit = async (data: ActivityFormData) => {
    if (!groupId) return;
    setServerError(null);

    try {
      const created = await agricultureApi.createActivity(groupId, {
        farmId: data.farmId,
        plotId: data.plotId || null,
        cropId: data.cropId || null,
        activityTypeId: data.activityTypeId,
        customActivityName: data.customActivityName,
        description: data.description,
      });
      navigate(`/activities/${created.id}`);
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
          to="/activities"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">नवीन काम जोडा</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            {selectedGroup?.name} — शेतातील उपक्रमाची नोंद
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
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green"
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
                तुकडा / प्लॉट निवडा (ऐच्छिक)
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green"
                {...register('plotId')}
              >
                <option value="">-- सर्व शेत / कोणताही नाही --</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plotName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Crop Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              पीक निवडा (ऐच्छिक)
            </label>
            <select
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green"
              {...register('cropId')}
            >
              <option value="">-- कोणत्याही विशिष्ट पिकासाठी नाही --</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cropNameCustom || c.cropNameMr} ({c.plotName})
                </option>
              ))}
            </select>
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              कामाचा प्रकार (Activity Type) *
            </label>
            <select
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green"
              {...register('activityTypeId')}
            >
              <option value="">-- कामाचा प्रकार निवडा --</option>
              {activityTypes.map((at) => (
                <option key={at.id} value={at.id}>
                  {at.nameMr} ({at.nameEn})
                </option>
              ))}
            </select>
            {errors.activityTypeId && (
              <p className="text-xs text-red-600 mt-1">{errors.activityTypeId.message}</p>
            )}
          </div>

          {/* Custom Name */}
          <Input
            label="कामाचे विशेष नाव (ऐच्छिक)"
            placeholder="उदा. ठिबक सिंचन, युरिया खत देणे, कीडनाशक फवारणी"
            error={errors.customActivityName?.message}
            {...register('customActivityName')}
          />

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              सविस्तर माहिती / वर्णन (ऐच्छिक)
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green"
              placeholder="उदा. उसाला ३ तास ठिबक सिंचन दिले, २ पोती युरिया टाकला..."
              {...register('description')}
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center space-x-3">
            <Button type="submit" variant="primary" className="flex-1" isLoading={isSubmitting}>
              काम जतन करा
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/activities')}
            >
              रद्द करा
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
