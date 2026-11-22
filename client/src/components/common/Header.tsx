import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/providers/AuthProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Users, LogOut, Sprout, User } from 'lucide-react';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const { user, selectedGroup, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo and Tagline */}
        <Link to="/" className="flex items-center space-x-2.5 text-brand-dark group">
          <div className="w-10 h-10 rounded-xl bg-brand-green flex items-center justify-center text-white shadow-sm group-hover:bg-brand-green-hover transition-colors">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight tracking-tight text-slate-900 flex items-center gap-1.5">
              <span>{t('appName')}</span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
              {t('tagline')}
            </p>
          </div>
        </Link>

        {/* Right side controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <LanguageSwitcher />

          {user && (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              {selectedGroup && (
                <Link
                  to="/family/select"
                  className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="max-w-[120px] truncate">{selectedGroup.name}</span>
                </Link>
              )}

              <Link
                to="/profile"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title={t('nav.profile')}
              >
                <User className="w-5 h-5" />
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title={t('common.logout')}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
