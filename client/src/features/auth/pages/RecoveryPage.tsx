import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { api, ApiError } from '../../../services/api/apiClient';
import { KeyRound, Lock, Phone } from 'lucide-react';

const recoveryFormSchema = z
  .object({
    phoneNumber: z.string().min(10, '१० अंकी मोबाईल नंबर आवश्यक आहे'),
    recoveryCode: z.string().min(4, 'रिकव्हरी कोड आवश्यक आहे'),
    newPassword: z
      .string()
      .min(8, 'पासवर्ड किमान ८ अक्षरांचा असावा')
      .regex(/[a-zA-Z]/, 'किमान एक अक्षर आवश्यक')
      .regex(/[0-9]/, 'किमान एक अंक आवश्यक'),
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'पासवर्ड जुळत नाहीत',
    path: ['confirmPassword'],
  });

type RecoveryFormData = z.infer<typeof recoveryFormSchema>;

export const RecoveryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoveryFormData>({
    resolver: zodResolver(recoveryFormSchema),
  });

  const onSubmit = async (data: RecoveryFormData) => {
    setServerError(null);
    try {
      const response = await api.post<{ message: string; newRecoveryCode: string }>('/auth/recover-password', {
        phoneNumber: data.phoneNumber,
        recoveryCode: data.recoveryCode.trim().toUpperCase(),
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });

      // Show new recovery code
      navigate('/recovery-code-display', {
        state: {
          recoveryCode: response.newRecoveryCode,
          phoneNumber: data.phoneNumber,
          password: data.newPassword,
          isRecoverySuccess: true,
        },
        replace: true,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError(t('common.errorOccurred'));
      }
    }
  };

  return (
    <Card className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{t('auth.recoveryTitle')}</h1>
        <p className="text-sm text-slate-600">{t('auth.recoverySubtitle')}</p>
      </div>

      {serverError && <Alert variant="error">{serverError}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="relative">
          <Input
            label={t('common.phone')}
            placeholder={t('auth.phonePlaceholder')}
            type="tel"
            autoComplete="tel"
            error={errors.phoneNumber?.message}
            {...register('phoneNumber')}
          />
          <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-9 pointer-events-none" />
        </div>

        <div className="relative">
          <Input
            label={t('auth.recoveryCode')}
            placeholder="उदा. 4A9K-7M2P"
            type="text"
            error={errors.recoveryCode?.message}
            {...register('recoveryCode')}
          />
          <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-9 pointer-events-none" />
        </div>

        <div className="relative">
          <Input
            label={t('auth.newPassword')}
            placeholder={t('auth.passwordPlaceholder')}
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-9 pointer-events-none" />
        </div>

        <div className="relative">
          <Input
            label={t('common.confirmPassword')}
            placeholder="नवीन पासवर्ड पुन्हा टाका"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-9 pointer-events-none" />
        </div>

        <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
          {t('auth.resetPasswordButton')}
        </Button>
      </form>

      <div className="text-center pt-2 border-t border-slate-200">
        <Link to="/login" className="text-xs font-semibold text-brand-green hover:underline">
          {t('common.back')} {t('auth.loginButton')}
        </Link>
      </div>
    </Card>
  );
};
