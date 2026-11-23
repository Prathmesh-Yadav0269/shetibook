import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { agricultureApi } from '../services/agricultureApi';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { Plus, MapPin, Sprout, ArrowRight } from 'lucide-react';

export const ActivityListPage: React.FC = () => {
  const { t } = useTranslation();
  const { selectedGroup } = useAuth();
  const navigate = useNavigate();
  const groupId = selectedGroup?.id;

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>('all');

  const { data: farms = [] } = useQuery({
    queryKey: ['farms', groupId],
    queryFn: () => agricultureApi.getFarms(groupId!),
    enabled: !!groupId,
  });

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['activities', groupId, statusFilter, selectedFarmFilter],
    queryFn: () =>
      agricultureApi.getActivities(groupId!, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        farmId: selectedFarmFilter === 'all' ? undefined : selectedFarmFilter,
      }),
    enabled: !!groupId,
  });

  if (!selectedGroup) {
    return (
      <Card className="text-center py-12 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">कोणताही कुटुंब गट निवडलेला नाही</h2>
        <Button variant="primary" onClick={() => navigate('/family/select')}>
          कुटुंब गट निवडा
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">शेतातील कामे व उपक्रम (Activities)</h1>
          <p className="text-sm text-slate-600">
            {selectedGroup.name} — पाणी, खत, फवारणी, नांगरणी इत्यादी कामांची नोंद व ट्रॅकिंग
          </p>
        </div>
        <Link to="/activities/new">
          <Button variant="primary" className="w-full sm:w-auto shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            नवीन काम जोडा
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error">{t('common.errorOccurred')}</Alert>}

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'सर्व कामे' },
            { id: 'in_progress', label: 'चालू (In Progress)' },
            { id: 'paused', label: 'थांबलेले (Paused)' },
            { id: 'pending', label: 'प्रलंबित (Pending)' },
            { id: 'completed', label: 'पूर्ण झालेली' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {farms.length > 0 && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500 font-medium">शेत:</span>
            <select
              value={selectedFarmFilter}
              onChange={(e) => setSelectedFarmFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-green"
            >
              <option value="all">सर्व शेते</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Activities Grid */}
      {isLoading ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">{t('common.loading')}</p>
        </div>
      ) : activities.length === 0 ? (
        <Card className="text-center py-16 px-4 space-y-4 border-dashed border-2 border-slate-300">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            📋
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">कोणतेही काम आढळले नाही</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              निवडलेल्या निकषांनुसार कामांची नोंद नाही. शेतातील कामाची नोंद ठेवण्यासाठी नवीन काम जोडा.
            </p>
          </div>
          <Link to="/activities/new">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              नवीन काम जोडा
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map((act) => (
            <Card
              key={act.id}
              className="p-4 hover:border-brand-green/60 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              onClick={() => navigate(`/activities/${act.id}`)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-brand-green transition-colors">
                      {act.customActivityName || act.activityNameMr}
                    </h3>
                    <span className="text-xs text-slate-500">{act.activityNameMr}</span>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      act.status === 'in_progress'
                        ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                        : act.status === 'paused'
                        ? 'bg-amber-100 text-amber-800'
                        : act.status === 'completed'
                        ? 'bg-blue-100 text-blue-800'
                        : act.status === 'pending'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {act.status === 'in_progress'
                      ? 'चालू (In Progress)'
                      : act.status === 'paused'
                      ? 'थांबलेले (Paused)'
                      : act.status === 'completed'
                      ? 'पूर्ण झाले'
                      : act.status === 'pending'
                      ? 'प्रलंबित (Pending)'
                      : 'रद्द'}
                  </span>
                </div>

                {/* Farm, Plot & Crop badges */}
                <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1">
                  <div className="flex items-center text-slate-600">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    <span>{act.farmName}</span>
                    {act.plotName && <span> • {act.plotName}</span>}
                  </div>
                  {act.cropNameMr && (
                    <div className="flex items-center text-slate-600">
                      <Sprout className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      <span>{act.cropNameCustom || act.cropNameMr}</span>
                    </div>
                  )}
                </div>

                {act.description && (
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {act.description}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-brand-green font-semibold">
                <span>तपशील व ट्रॅकिंग</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
