import React from 'react';
import { useTranslation } from 'react-i18next';

export const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
      <div className="max-w-6xl mx-auto px-4 space-y-1">
        <p className="font-medium text-slate-700">
          {t('appName')} — {t('tagline')}
        </p>
        <p className="text-[11px] text-slate-400">
          © {new Date().getFullYear()} ShetiBook. All rights reserved. Built for farmers.
        </p>
      </div>
    </footer>
  );
};
