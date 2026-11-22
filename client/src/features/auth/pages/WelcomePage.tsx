import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Sprout, Users, ShieldCheck, ArrowRight } from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Card className="text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center mx-auto">
        <Sprout className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {t('auth.welcomeTitle')}
        </h1>
        <p className="text-slate-600 text-sm sm:text-base font-medium">
          {t('auth.welcomeSubtitle')}
        </p>
        <p className="text-xs font-semibold text-brand-green bg-emerald-50 py-1.5 px-3 rounded-full inline-block">
          {t('tagline')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 py-2 text-left">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex items-start space-x-2.5">
          <Users className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-slate-900">कुटुंब सहकार्य</h4>
            <p className="text-[11px] text-slate-500">एकाच शेतीवर कुटुंबातील सर्व सदस्य मिळून काम</p>
          </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex items-start space-x-2.5">
          <ShieldCheck className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-slate-900">सुरक्षित हिशोब</h4>
            <p className="text-[11px] text-slate-500">Argon2id सुरक्षा आणि डेटा गोपनीयता</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Link to="/login" className="block w-full">
          <Button variant="primary" className="w-full flex items-center justify-center space-x-2">
            <span>{t('auth.loginButton')}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
        <Link to="/register" className="block w-full">
          <Button variant="outline" className="w-full">
            {t('auth.registerButton')}
          </Button>
        </Link>
      </div>
    </Card>
  );
};
