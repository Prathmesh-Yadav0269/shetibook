import React from 'react';
import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { Header } from '../../components/common/Header';
import { Footer } from '../../components/common/Footer';
import { useTranslation } from 'react-i18next';
import { Users, Grid, Sprout, Activity, User } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, selectedGroup, isLoading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 font-medium text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9]">
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-8">
        <Outlet />
      </main>
      <Footer />

      {/* Mobile Bottom Navigation */}
      {selectedGroup && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 px-2 py-1.5 flex items-center justify-around shadow-lg">
          <Link
            to="/family/overview"
            className="flex flex-col items-center py-1 px-2 text-[10px] font-semibold text-slate-600 hover:text-brand-green"
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span>कुटुंब</span>
          </Link>
          <Link
            to="/farms"
            className="flex flex-col items-center py-1 px-2 text-[10px] font-semibold text-slate-600 hover:text-brand-green"
          >
            <Grid className="w-5 h-5 mb-0.5" />
            <span>शेती</span>
          </Link>
          <Link
            to="/crops"
            className="flex flex-col items-center py-1 px-2 text-[10px] font-semibold text-slate-600 hover:text-brand-green"
          >
            <Sprout className="w-5 h-5 mb-0.5" />
            <span>पिके</span>
          </Link>
          <Link
            to="/activities"
            className="flex flex-col items-center py-1 px-2 text-[10px] font-semibold text-slate-600 hover:text-brand-green"
          >
            <Activity className="w-5 h-5 mb-0.5" />
            <span>कामे</span>
          </Link>
          <Link
            to="/profile"
            className="flex flex-col items-center py-1 px-2 text-[10px] font-semibold text-slate-600 hover:text-brand-green"
          >
            <User className="w-5 h-5 mb-0.5" />
            <span>खाते</span>
          </Link>
        </nav>
      )}
    </div>
  );
};

