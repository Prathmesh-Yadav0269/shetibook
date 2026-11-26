import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/providers/AuthProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { notificationApi } from '../../features/notifications/services/notificationApi';
import { Users, LogOut, Sprout, User, Bell, LayoutDashboard, FileText } from 'lucide-react';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const { user, selectedGroup, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  useEffect(() => {
    if (!selectedGroup) return;
    notificationApi
      .getNotifications(selectedGroup.id, true)
      .then((res) => setUnreadNotifications(res.unreadCount))
      .catch(() => {});
  }, [selectedGroup?.id]);

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

        {/* Desktop Navigation Links */}
        {user && selectedGroup && (
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              to="/dashboard"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-brand-green hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              डॅशबोर्ड
            </Link>
            <Link
              to="/family/overview"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-brand-green hover:bg-slate-50 transition-colors"
            >
              कुटुंब
            </Link>
            <Link
              to="/farms"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-brand-green hover:bg-slate-50 transition-colors"
            >
              शेती व तुकडे
            </Link>
            <Link
              to="/crops"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-brand-green hover:bg-slate-50 transition-colors"
            >
              पिके
            </Link>
            <Link
              to="/activities"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-brand-green hover:bg-slate-50 transition-colors"
            >
              कामे व उपक्रम
            </Link>
            <Link
              to="/expenses"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-brand-green hover:bg-slate-50 transition-colors"
            >
              खर्च
            </Link>
            <Link
              to="/harvests"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-brand-green hover:bg-slate-50 transition-colors"
            >
              काढणी
            </Link>
            <Link
              to="/sales"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-brand-green hover:bg-slate-50 transition-colors"
            >
              विक्री
            </Link>
            <Link
              to="/reports"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-green hover:bg-emerald-50 transition-colors flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              अहवाल
            </Link>
            <Link
              to="/finance/summary"
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              नफा-तोटा
            </Link>
          </nav>
        )}

        {/* Right side controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <LanguageSwitcher />

          {user && (
            <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200">
              {selectedGroup && (
                <>
                  <Link
                    to="/notifications"
                    className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    title="सूचना केंद्र"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadNotifications > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-white animate-pulse" />
                    )}
                  </Link>

                  <Link
                    to="/family/select"
                    className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span className="max-w-[120px] truncate">{selectedGroup.name}</span>
                  </Link>
                </>
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
