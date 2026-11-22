import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { User, ShieldCheck, Users, LogOut } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, groups, logout } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">{t('profile.title')}</h1>
      </div>

      <Card className="space-y-6">
        <div className="flex items-center space-x-4 pb-4 border-b border-slate-200">
          <div className="w-14 h-14 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{user?.phoneNumber}</h2>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                {t('common.active')} खाते
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900">{t('profile.myGroups')}</h3>
          <div className="grid gap-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="p-3 rounded-lg border border-slate-200/80 bg-slate-50 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2.5">
                  <Users className="w-4 h-4 text-brand-green" />
                  <span className="font-semibold text-sm text-slate-800">{group.name}</span>
                </div>
                <span className="text-xs font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {group.role === 'owner' ? t('family.roleOwner') : t('family.roleMember')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <Button
            variant="danger"
            size="sm"
            onClick={logout}
            className="flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('common.logout')}</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};
