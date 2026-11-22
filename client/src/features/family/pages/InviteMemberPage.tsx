import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../../app/providers/AuthProvider';
import { api, ApiError } from '../../../services/api/apiClient';
import { CreateInvitationResponse } from '../types';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { UserPlus, Copy, Check, ArrowLeft } from 'lucide-react';

const inviteSchema = z.object({
  intendedPhone: z
    .string()
    .optional()
    .refine(val => !val || /^[6-9]\d{9}$/.test(val.replace(/\D/g, '')), {
      message: '१० अंकी वैध मोबाईल नंबर टाका किंवा रिकामे ठेवा',
    }),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export const InviteMemberPage: React.FC = () => {
  const { t } = useTranslation();
  const { selectedGroup } = useAuth();
  const navigate = useNavigate();

  const [invitationResult, setInvitationResult] = useState<CreateInvitationResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  });

  if (!selectedGroup) {
    navigate('/family/select');
    return null;
  }

  const onSubmit = async (data: InviteFormData) => {
    setServerError(null);
    try {
      const response = await api.post<CreateInvitationResponse>(
        `/groups/${selectedGroup.id}/invitations`,
        {
          intendedPhone: data.intendedPhone ? data.intendedPhone.trim() : undefined,
        }
      );

      setInvitationResult(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError(t('common.errorOccurred'));
      }
    }
  };

  const inviteLink = invitationResult
    ? `${window.location.origin}/family/join?token=${invitationResult.token}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Link
        to="/family/overview"
        className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t('common.back')}</span>
      </Link>

      <Card className="space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center mx-auto">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('family.inviteMember')}</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            {selectedGroup.name} मध्ये सामील होण्यासाठी आमंत्रण तयार करा
          </p>
        </div>

        {serverError && <Alert variant="error">{serverError}</Alert>}

        {!invitationResult ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label={t('family.invitePhone')}
              placeholder="उदा. 9876543210 (पर्यायी)"
              type="tel"
              error={errors.intendedPhone?.message}
              helperText="जर मोबाईल नंबर टाकला, तर फक्त तोच व्यक्ती सामील होऊ शकेल"
              {...register('intendedPhone')}
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
              {t('family.generateInviteButton')}
            </Button>
          </form>
        ) : (
          <div className="space-y-5">
            <Alert variant="success" title="आमंत्रण तयार झाले!">
              {t('family.inviteShareInstruction')}
            </Alert>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                आमंत्रण लिंक / कोड
              </label>
              <div className="p-3 bg-slate-100 rounded-lg border border-slate-300 font-mono text-xs break-all text-slate-800">
                {inviteLink}
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full flex items-center justify-center space-x-2"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('common.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{t('common.copy')} लिंक</span>
                </>
              )}
            </Button>

            <Link to="/family/overview" className="block text-center">
              <Button variant="outline" size="sm" className="w-full">
                {t('common.back')} {t('family.overviewTitle')}
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
};
