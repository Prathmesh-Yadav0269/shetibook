import React, { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { api } from '../../../services/api/apiClient';
import { useAuth } from '../../../app/providers/AuthProvider';
import { LoginResponse } from '../types';
import { Copy, Check, ShieldAlert } from 'lucide-react';

export const RecoveryCodeDisplayPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser, setGroups, selectGroup } = useAuth();

  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const state = location.state as {
    recoveryCode?: string;
    phoneNumber?: string;
    password?: string;
    isRecoverySuccess?: boolean;
  } | null;

  if (!state?.recoveryCode) {
    return <Navigate to="/login" replace />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(state.recoveryCode!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleProceed = async () => {
    if (!state.phoneNumber || !state.password) {
      navigate('/login');
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        phoneNumber: state.phoneNumber,
        password: state.password,
      });

      setUser(response.user);
      setGroups(response.groups);

      if (response.groups.length > 0) {
        selectGroup(response.groups[0].id);
        navigate('/family/overview');
      } else {
        navigate('/family/create');
      }
    } catch {
      navigate('/login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <Card className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          {t('auth.codeWarningTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          {t('auth.codeWarningDesc')}
        </p>
      </div>

      <Alert variant="warning">
        हा कोड तुमच्या खात्याची चावी आहे. जर तुम्ही पासवर्ड विसरलात तर या कोडशिवाय खाते कधीही उघडणार नाही.
      </Alert>

      {/* Code Display Box */}
      <div className="p-4 bg-slate-900 text-white rounded-xl text-center space-y-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
          तुमचा वन-टाइम १२८-बिट रिकव्हरी कोड
        </span>
        <div className="font-mono text-sm sm:text-base md:text-lg font-bold tracking-wider text-emerald-400 select-all break-all px-2 py-1 bg-slate-950/60 rounded">
          {state.recoveryCode}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          className="text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              <span>{t('common.copied')}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 mr-1" />
              <span>{t('common.copy')}</span>
            </>
          )}
        </Button>
      </div>

      {/* Confirmation Checkbox */}
      <div className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <input
          id="confirmSaved"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-4 h-4 mt-0.5 rounded border-slate-300 text-brand-green focus:ring-brand-green"
        />
        <label htmlFor="confirmSaved" className="text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer">
          {t('auth.codeSavedConfirmation')}
        </label>
      </div>

      <Button
        variant="primary"
        className="w-full"
        disabled={!confirmed}
        isLoading={isLoggingIn}
        onClick={handleProceed}
      >
        {t('auth.proceedToApp')}
      </Button>
    </Card>
  );
};
