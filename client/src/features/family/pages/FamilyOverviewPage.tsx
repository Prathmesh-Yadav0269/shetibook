import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { api, ApiError } from '../../../services/api/apiClient';
import { FarmingGroupDetails } from '../types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import {
  Users,
  UserPlus,
  UserMinus,
  Calendar,
} from 'lucide-react';

export const FamilyOverviewPage: React.FC = () => {
  const { t } = useTranslation();
  const { selectedGroup, user, groups } = useAuth();
  const navigate = useNavigate();

  const [details, setDetails] = useState<FarmingGroupDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (!selectedGroup) {
      if (groups.length === 0) {
        navigate('/family/create');
      } else {
        navigate('/family/select');
      }
      return;
    }

    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.get<FarmingGroupDetails>(`/groups/${selectedGroup.id}`);
        setDetails(data);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t('common.errorOccurred'));
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedGroup?.id]);

  const handleRemoveMember = async (memberUserId: string) => {
    if (!selectedGroup) return;
    setIsRemoving(true);
    try {
      await api.delete(`/groups/${selectedGroup.id}/members/${memberUserId}`);
      const data = await api.get<FarmingGroupDetails>(`/groups/${selectedGroup.id}`);
      setDetails(data);
      setMemberToRemove(null);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    } finally {
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-3">{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Alert variant="error">{error || 'Group details not found'}</Alert>
        <Link to="/family/select">
          <Button variant="outline">{t('nav.switchGroup')}</Button>
        </Link>
      </div>
    );
  }

  const isOwner = details.currentRole === 'owner';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Group Header Card */}
      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-14 h-14 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
            <Users className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">{details.group.name}</h1>
              {isOwner && (
                <span className="bg-emerald-100 text-brand-green text-xs font-bold px-2 py-0.5 rounded-full">
                  {t('family.roleOwner')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>सुरुवात: {new Date(details.group.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {isOwner && (
            <Link to="/family/invite" className="flex-1 sm:flex-none">
              <Button variant="primary" size="sm" className="w-full flex items-center justify-center space-x-1.5">
                <UserPlus className="w-4 h-4" />
                <span>{t('family.inviteMember')}</span>
              </Button>
            </Link>
          )}
          <Link to="/family/select" className="flex-1 sm:flex-none">
            <Button variant="outline" size="sm" className="w-full">
              {t('nav.switchGroup')}
            </Button>
          </Link>
        </div>
      </Card>

      {/* Members List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <span>{t('family.membersListTitle')}</span>
            <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
              {details.members.length}
            </span>
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {details.members.map((member) => {
            const isSelf = member.userId === user?.id;
            return (
              <Card key={member.membershipId} className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-base">
                      {member.phoneNumber}
                    </span>
                    {isSelf && (
                      <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                        तुम्ही
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {member.role === 'owner' ? t('family.roleOwner') : t('family.roleMember')}
                    </span>
                    <span>•</span>
                    <span>सामील: {new Date(member.joinedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {isOwner && member.role !== 'owner' && (
                  <div>
                    {memberToRemove === member.userId ? (
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={isRemoving}
                          onClick={() => handleRemoveMember(member.userId)}
                          className="text-xs px-2 py-1"
                        >
                          {t('common.remove')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setMemberToRemove(null)}
                          className="text-xs px-2 py-1"
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMemberToRemove(member.userId)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        title={t('common.remove')}
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Pending Invitations (Owner Only) */}
      {isOwner && details.pendingInvitations.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <span>{t('family.pendingInvitations')}</span>
            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {details.pendingInvitations.length}
            </span>
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {details.pendingInvitations.map((inv) => (
              <Card key={inv.id} className="p-3.5 space-y-1.5 bg-amber-50/50 border-amber-200/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {inv.intendedPhone ? `मोबाईल: ${inv.intendedPhone}` : 'खुले आमंत्रण (कोणीही)'}
                  </span>
                  <span className="text-amber-700 font-medium">प्रलंबित</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  कालबाह्य: {new Date(inv.expiresAt).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Safe scope notification banner */}
      <Alert variant="info" className="mt-8">
        <div className="text-xs leading-relaxed">
          <strong>फेज १ पायाभूत सुविधा:</strong> खाते आणि कुटुंब व्यवस्थापन पूर्णपणे कार्यरत आहे. शेतीचे प्लॉट, पिके, खर्च आणि उत्पन्नाच्या नोंदी पुढील फेजमध्ये सुरू होतील.
        </div>
      </Alert>
    </div>
  );
};
