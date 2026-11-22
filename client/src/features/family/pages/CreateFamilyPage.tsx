import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { api, ApiError } from '../../../services/api/apiClient';
import { useAuth } from '../../../app/providers/AuthProvider';
import { Sprout } from 'lucide-react';

const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'गटाचे नाव किमान २ अक्षरांचे असावे').max(60, 'गटाचे नाव खूप मोठे आहे'),
});

type CreateGroupFormData = z.infer<typeof createGroupSchema>;

export const CreateFamilyPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshUser, selectGroup } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
  });

  const onSubmit = async (data: CreateGroupFormData) => {
    setServerError(null);
    try {
      const response = await api.post<{ id: string; name: string }>('/groups', {
        name: data.name,
      });

      await refreshUser();
      selectGroup(response.id);
      navigate('/family/overview');
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError(t('common.errorOccurred'));
      }
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card className="space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center mx-auto">
            <Sprout className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('family.createNewGroup')}</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            तुमच्या शेतीसाठी एक कुटुंब गट तयार करा. तुम्ही या गटाचे प्रमुख (मालक) असाल.
          </p>
        </div>

        {serverError && <Alert variant="error">{serverError}</Alert>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label={t('family.groupName')}
            placeholder={t('family.groupNamePlaceholder')}
            error={errors.name?.message}
            helperText="उदा. यादव कुटुंब शेती, मोरे बंधू शेती"
            {...register('name')}
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
            {t('family.createGroupButton')}
          </Button>
        </form>
      </Card>
    </div>
  );
};
