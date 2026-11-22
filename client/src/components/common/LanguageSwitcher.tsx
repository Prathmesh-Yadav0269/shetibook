import React from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../services/i18n';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language.startsWith('mr') ? 'mr' : 'en';

  return (
    <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
      <Globe className="w-4 h-4 text-slate-500 ml-1.5" />
      <button
        type="button"
        onClick={() => changeLanguage('mr')}
        className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
          currentLang === 'mr'
            ? 'bg-brand-green text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        मराठी
      </button>
      <button
        type="button"
        onClick={() => changeLanguage('en')}
        className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
          currentLang === 'en'
            ? 'bg-brand-green text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        English
      </button>
    </div>
  );
};
