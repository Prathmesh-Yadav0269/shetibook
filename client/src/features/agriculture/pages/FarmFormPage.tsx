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

const farmFormSchema = z.object({
  farmName: z.string().trim().min(2, 'शेताचे नाव किमान २ अक्षरांचे असावे').max(100),
  village: z.string().trim().min(2, 'गावाचे नाव आवश्यक आहे').max(100),
  taluka: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  areaValue: z.number({ invalid_type_error: 'क्षेत्र संख्या स्वरूपात टाका' }).positive('क्षेत्र ० पेक्षा जास्त असावे'),
  areaUnit: z.enum(['acre', 'guntha', 'hectare']),
  surveyNumber: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(1000).optional(),
});

type FarmFormData = z.infer<typeof farmFormSchema>;

export const FarmFormPage: React.FC = () => {
  const { farmId } = useParams<{ farmId?: string }>();
  const isEdit = !!farmId;
  const navigate = useNavigate();
  const { selectedGroup } = useAuth();
  const groupId = selectedGroup?.id;

  const [serverError, setServerError] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(isEdit);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FarmFormData>({
    resolver: zodResolver(farmFormSchema),
    defaultValues: {
      areaUnit: 'acre',
      areaValue: 1,
    },
  });

  const watchedValue = watch('areaValue');
  const watchedUnit = watch('areaUnit') as AreaUnit;
  const areaBreakdown = calculateAreaBreakdown(Number(watchedValue) || 0, watchedUnit || 'acre');

  useEffect(() => {
    if (isEdit && groupId && farmId) {
      agricultureApi
        .getFarm(groupId, farmId)
        .then((farm) => {
          reset({
            farmName: farm.farmName,
            village: farm.village,
            taluka: farm.taluka || '',
            district: farm.district || '',
            areaValue: farm.areaValue,
            areaUnit: farm.areaUnit,
            surveyNumber: farm.surveyNumber || '',
            notes: farm.notes || '',
          });
        })
        .catch(() => setServerError('शेत माहिती लोड करता आली नाही.'))
        .finally(() => setLoadingInitial(false));
    }
  }, [isEdit, groupId, farmId, reset]);

  const onSubmit = async (data: FarmFormData) => {
    if (!groupId) return;
    setServerError(null);

    try {
      if (isEdit && farmId) {
        await agricultureApi.updateFarm(groupId, farmId, data);
        navigate(`/farms/${farmId}`);
      } else {
        const created = await agricultureApi.createFarm(groupId, data);
        navigate(`/farms/${created.id}`);
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
          to={isEdit && farmId ? `/farms/${farmId}` : '/farms'}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isEdit ? 'शेताच्या माहितीत बदल करा' : 'नवीन शेत जोडा'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            {selectedGroup?.name} अंतर्गत जमिनीची नोंदणी करा
          </p>
        </div>
      </div>

      {serverError && <Alert variant="error">{serverError}</Alert>}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Farm Name */}
          <Input
            label="शेताचे नाव *"
            placeholder="उदा. वडिलांचे शेत, मळा, नदीकाठची जमीन"
            error={errors.farmName?.message}
            {...register('farmName')}
          />

          {/* Location fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="गाव *"
              placeholder="उदा. बारामती"
              error={errors.village?.message}
              {...register('village')}
            />
            <Input
              label="तालुका"
              placeholder="उदा. बारामती"
              error={errors.taluka?.message}
              {...register('taluka')}
            />
            <Input
              label="जिल्हा"
              placeholder="उदा. पुणे"
              error={errors.district?.message}
              {...register('district')}
            />
          </div>

          {/* Area & Unit Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-slate-800 font-semibold text-sm">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>जमिनीचे क्षेत्रफळ व एकक *</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="क्षेत्र (Area Value)"
                type="number"
                step="any"
                placeholder="उदा. 2.5"
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
                {errors.areaUnit && (
                  <p className="text-xs text-red-600 mt-1">{errors.areaUnit.message}</p>
                )}
              </div>
            </div>

            {/* Live Conversion Preview Card */}
            {Number(watchedValue) > 0 && (
              <div className="mt-3 p-3 bg-white border border-emerald-200 rounded-lg text-xs space-y-1">
                <span className="font-semibold text-emerald-800 block text-[11px] uppercase tracking-wider">
                  स्वयंचलित रूपांतरण (Auto Equivalents):
                </span>
                <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                  <div className="bg-emerald-50/70 p-1.5 rounded">
                    <span className="text-slate-500 block text-[10px]">एकर</span>
                    <span className="font-bold text-slate-900">{areaBreakdown.acre} एकर</span>
                  </div>
                  <div className="bg-emerald-50/70 p-1.5 rounded">
                    <span className="text-slate-500 block text-[10px]">गुंठे</span>
                    <span className="font-bold text-slate-900">{areaBreakdown.guntha} गुंठे</span>
                  </div>
                  <div className="bg-emerald-50/70 p-1.5 rounded">
                    <span className="text-slate-500 block text-[10px]">हेक्टर</span>
                    <span className="font-bold text-slate-900">{areaBreakdown.hectare} हेक्टर</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Survey Number */}
          <Input
            label="गट / सर्व्हे नंबर (ऐच्छिक)"
            placeholder="उदा. 124/2A"
            error={errors.surveyNumber?.message}
            {...register('surveyNumber')}
          />

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              टीप / विशेष माहिती (ऐच्छिक)
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green"
              placeholder="उदा. विहिरीचे पाणी, काळी कसदार जमीन, रस्त्यालगत..."
              {...register('notes')}
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center space-x-3">
            <Button type="submit" variant="primary" className="flex-1" isLoading={isSubmitting}>
              {isEdit ? 'बदल सेव्ह करा' : 'शेत जतन करा'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(isEdit && farmId ? `/farms/${farmId}` : '/farms')}
            >
              रद्द करा
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
