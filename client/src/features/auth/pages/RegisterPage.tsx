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
import { RegisterResponse } from '../types';
import { Lock, Phone } from 'lucide-react';

const registerFormSchema = z
  .object({
    phoneNumber: z
      .string()
      .min(10, '१० अंकी मोबाईल नंबर आवश्यक आहे')
      .regex(/^[6-9]\d{9}$/, 'कृपया वैध भारतीय मोबाईल नंबर टाका (उदा. 9876543210)'),
    password: z
      .string()
      .min(8, 'पासवर्ड किमान ८ अक्षरांचा असावा')
      .regex(/[a-zA-Z]/, 'पासवर्डमध्ये किमान एक अक्षर असणे आवश्यक आहे')
      .regex(/[0-9]/, 'पासवर्डमध्ये किमान एक अंक असणे आवश्यक आहे'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'पासवर्ड जुळत नाहीत',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerFormSchema>;

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      const response = await api.post<RegisterResponse>('/auth/register', {
        phoneNumber: data.phoneNumber,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      // Navigate to recovery code display page with state
      navigate('/recovery-code-display', {
        state: {
          recoveryCode: response.recoveryCode,
          phoneNumber: response.phoneNumber,
          password: data.password,
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
        <h1 className="text-2xl font-bold text-slate-900">{t('auth.registerTitle')}</h1>
        <p className="text-sm text-slate-600">{t('auth.registerSubtitle')}</p>
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
            label={t('common.password')}
            placeholder={t('auth.passwordPlaceholder')}
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            helperText="किमान ८ अक्षरे (अक्षरे आणि अंक दोन्ही आवश्यक)"
            {...register('password')}
          />
          <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-9 pointer-events-none" />
        </div>

        <div className="relative">
          <Input
            label={t('common.confirmPassword')}
            placeholder="पासवर्ड पुन्हा टाका"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-9 pointer-events-none" />
        </div>

        <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
          {t('auth.registerButton')}
        </Button>
      </form>

      <div className="text-center pt-2 border-t border-slate-200">
        <p className="text-xs text-slate-600">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-brand-green hover:underline">
            {t('auth.loginButton')}
          </Link>
        </p>
      </div>
    </Card>
  );
};
