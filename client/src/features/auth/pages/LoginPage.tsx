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
import { useAuth } from '../../../app/providers/AuthProvider';
import { LoginResponse } from '../types';
import { Lock, Phone } from 'lucide-react';

const loginFormSchema = z.object({
  phoneNumber: z.string().min(10, '१० अंकी मोबाईल नंबर आवश्यक आहे'),
  password: z.string().min(1, 'पासवर्ड आवश्यक आहे'),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser, setGroups, selectGroup } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        phoneNumber: data.phoneNumber,
        password: data.password,
      });

      setUser(response.user);
      setGroups(response.groups);

      if (response.groups.length === 1) {
        selectGroup(response.groups[0].id);
        navigate('/family/overview');
      } else if (response.groups.length > 1) {
        navigate('/family/select');
      } else {
        navigate('/family/create');
      }
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
        <h1 className="text-2xl font-bold text-slate-900">{t('auth.loginTitle')}</h1>
        <p className="text-sm text-slate-600">{t('auth.loginSubtitle')}</p>
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
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-9 pointer-events-none" />
        </div>

        <div className="flex justify-end">
          <Link
            to="/recovery"
            className="text-xs font-semibold text-brand-green hover:underline focus:outline-none"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
          {t('auth.loginButton')}
        </Button>
      </form>

      <div className="text-center pt-2 border-t border-slate-200">
        <p className="text-xs text-slate-600">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-brand-green hover:underline">
            {t('auth.registerButton')}
          </Link>
        </p>
      </div>
    </Card>
  );
};
