import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { agricultureApi } from '../services/agricultureApi';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { formatArea } from '../../../utils/area';
import { Plus, MapPin, Grid, Sprout, AlertCircle, ArrowRight } from 'lucide-react';

export const FarmListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedGroup } = useAuth();
  const navigate = useNavigate();
  const lang = (i18n.language === 'en' ? 'en' : 'mr') as 'mr' | 'en';

  const groupId = selectedGroup?.id;

  const { data: farms = [], isLoading, error } = useQuery({
    queryKey: ['farms', groupId],
    queryFn: () => agricultureApi.getFarms(groupId!),
    enabled: !!groupId,
  });

  if (!selectedGroup) {
    return (
      <Card className="text-center py-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">कोणताही कुटुंब गट निवडलेला नाही</h2>
        <p className="text-sm text-slate-600">शेती व्यवस्थापनासाठी कृपया कुटुंब गट निवडा.</p>
        <Button variant="primary" onClick={() => navigate('/family/select')}>
          कुटुंब गट निवडा
        </Button>
      </Card>
    );
  }

  // Calculate total group land
  const totalAreaAcre = farms.reduce((sum, f) => sum + (f.breakdown?.acre || 0), 0);
  const totalPlots = farms.reduce((sum, f) => sum + f.plotCount, 0);
  const totalActiveCrops = farms.reduce((sum, f) => sum + f.activeCropCount, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('agriculture.farmsTitle', 'शेती व्यवस्थापन')}</h1>
          <p className="text-sm text-slate-600">
            {selectedGroup.name} — {t('agriculture.farmsSubtitle', 'तुमच्या सर्व शेतजमिनी, तुकडे व पिकांची माहिती')}
          </p>
        </div>
        <Link to="/farms/new">
          <Button variant="primary" className="w-full sm:w-auto shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {t('agriculture.addFarmButton', 'नवीन शेत जोडा')}
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error">{t('common.errorOccurred')}</Alert>}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-emerald-50/60 border-emerald-100 flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            🌾
          </div>
          <div>
            <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              {t('agriculture.totalLand', 'एकूण शेतजमीन')}
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {totalAreaAcre.toFixed(2)} {t('units.acre', 'एकर')}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-blue-50/60 border-blue-100 flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
              {t('agriculture.totalPlots', 'एकूण तुकडे / प्लॉट')}
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {totalPlots} {t('common.plotsCount', 'प्लॉट')}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-amber-50/60 border-amber-100 flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              {t('agriculture.activeCrops', 'सध्याची पिके')}
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {totalActiveCrops} {t('common.cropsCount', 'पिके')}
            </div>
          </div>
        </Card>
      </div>

      {/* Farm Cards Grid */}
      {isLoading ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">{t('common.loading')}</p>
        </div>
      ) : farms.length === 0 ? (
        <Card className="text-center py-16 px-4 space-y-4 border-dashed border-2 border-slate-300">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto text-2xl">
            🌱
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {t('agriculture.noFarmsYet', 'अद्याप कोणतेही शेत नोंदवले नाही')}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {t('agriculture.noFarmsDesc', 'तुमच्या शेतजमिनीची नोंद करा, क्षेत्र टाका आणि तुकडे तयार करा.')}
            </p>
          </div>
          <Link to="/farms/new">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {t('agriculture.addFirstFarm', 'पहिले शेत जोडा')}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {farms.map((farm) => (
            <Card
              key={farm.id}
              className="p-5 hover:border-brand-green/60 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              onClick={() => navigate(`/farms/${farm.id}`)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-green transition-colors">
                      {farm.farmName}
                    </h3>
                    <div className="flex items-center text-xs text-slate-500 mt-1 space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{farm.village}</span>
                      {farm.taluka && <span>, {farm.taluka}</span>}
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {formatArea(farm.areaValue, farm.areaUnit, lang)}
                  </span>
                </div>

                {farm.surveyNumber && (
                  <div className="text-xs text-slate-600 bg-slate-100 inline-block px-2 py-0.5 rounded">
                    गट / सर्व्हे नं: <span className="font-semibold text-slate-800">{farm.surveyNumber}</span>
                  </div>
                )}

                {/* Plot & Crop Stats */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg">
                    <span className="text-slate-500 block">तुकडे (Plots)</span>
                    <span className="font-bold text-slate-800 text-sm">{farm.plotCount}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg">
                    <span className="text-slate-500 block">सध्याची पिके</span>
                    <span className="font-bold text-slate-800 text-sm">{farm.activeCropCount}</span>
                  </div>
                </div>

                {/* Unallocated Area Alert */}
                {farm.unallocatedInUnit > 0.05 && (
                  <p className="text-[11px] text-slate-500">
                    शिल्लक वाटप नसलेले क्षेत्र: <span className="font-semibold text-emerald-700">{farm.unallocatedInUnit} {farm.areaUnit === 'acre' ? 'एकर' : farm.areaUnit}</span>
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-brand-green font-semibold">
                <span>{t('common.viewDetails', 'सविस्तर पहा')}</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
