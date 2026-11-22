import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Users, Plus, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';

export const FamilySelectPage: React.FC = () => {
  const { t } = useTranslation();
  const { groups, selectGroup } = useAuth();
  const navigate = useNavigate();

  const handleSelect = (groupId: string) => {
    selectGroup(groupId);
    navigate('/family/overview');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">{t('family.groupSelectTitle')}</h1>
        <p className="text-sm text-slate-600">{t('family.groupSelectSubtitle')}</p>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <Card
            key={group.id}
            className="hover:border-brand-green/60 hover:shadow-md transition-all cursor-pointer"
          >
            <div
              onClick={() => handleSelect(group.id)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-base text-slate-900">{group.name}</h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                      {group.role === 'owner' ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          {t('family.roleOwner')}
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 mr-1" />
                          {t('family.roleMember')}
                        </>
                      )}
                    </span>
                    <span>•</span>
                    <span>{new Date(group.joinedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>
          </Card>
        ))}

        {groups.length === 0 && (
          <Card className="text-center py-8 space-y-4">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-600 max-w-sm mx-auto">{t('family.noGroups')}</p>
          </Card>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Link to="/family/create" className="flex-1">
          <Button variant="primary" className="w-full flex items-center justify-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>{t('family.createNewGroup')}</span>
          </Button>
        </Link>
        <Link to="/family/join" className="flex-1">
          <Button variant="outline" className="w-full flex items-center justify-center space-x-2">
            <Users className="w-4 h-4" />
            <span>{t('family.joinGroup')}</span>
          </Button>
        </Link>
      </div>
    </div>
  );
};
