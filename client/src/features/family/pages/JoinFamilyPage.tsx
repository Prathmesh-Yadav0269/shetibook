import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Users } from 'lucide-react';

const joinSchema = z.object({
  token: z.string().trim().min(8, 'वैध आमंत्रण कोड आवश्यक आहे'),
});

type JoinFormData = z.infer<typeof joinSchema>;

export const JoinFamilyPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser, selectGroup } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const initialToken = searchParams.get('token') || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      token: initialToken,
    },
  });

  const onSubmit = async (data: JoinFormData) => {
    setServerError(null);
    try {
      const response = await api.post<{ groupId: string; groupName: string }>('/groups/join', {
        token: data.token,
      });

      setSuccessMsg(`तुम्ही "${response.groupName}" या गटात यशस्वीरित्या सामील झाला आहात!`);
      await refreshUser();
      selectGroup(response.groupId);

      setTimeout(() => {
        navigate('/family/overview');
      }, 1500);
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
            <Users className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('family.joinTitle')}</h1>
          <p className="text-xs sm:text-sm text-slate-600">{t('family.joinSubtitle')}</p>
        </div>

        {serverError && <Alert variant="error">{serverError}</Alert>}
        {successMsg && (
          <Alert variant="success" title="अभिनंदन!">
            {successMsg}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label={t('family.inviteToken')}
            placeholder={t('family.joinTokenPlaceholder')}
            error={errors.token?.message}
            helperText="गटाच्या प्रमुखाने पाठवलेला आमंत्रण कोड टाका"
            {...register('token')}
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
            {t('family.joinButton')}
          </Button>
        </form>
      </Card>
    </div>
  );
};
