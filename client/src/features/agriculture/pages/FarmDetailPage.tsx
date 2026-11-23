import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { agricultureApi } from '../services/agricultureApi';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { formatArea } from '../../../utils/area';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Grid,
  Sprout,
  Activity as ActivityIcon,
  ChevronRight,
} from 'lucide-react';

export const FarmDetailPage: React.FC = () => {
  const { farmId } = useParams<{ farmId: string }>();
  const { selectedGroup } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const lang = (i18n.language === 'en' ? 'en' : 'mr') as 'mr' | 'en';

  const groupId = selectedGroup?.id;
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const { data: farm, isLoading, error } = useQuery({
    queryKey: ['farm', groupId, farmId],
    queryFn: () => agricultureApi.getFarm(groupId!, farmId!),
    enabled: !!groupId && !!farmId,
  });

  const archiveMutation = useMutation({
    mutationFn: () => agricultureApi.archiveFarm(groupId!, farmId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farms', groupId] });
      navigate('/farms');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'शेत अर्काइव्ह करता आले नाही.';
      setArchiveError(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error || !farm) {
    return (
      <Card className="text-center py-12 space-y-4">
        <Alert variant="error">शेत आढळले नाही किंवा काढण्यात आले आहे.</Alert>
        <Link to="/farms">
          <Button variant="secondary">शेतांच्या यादीकडे परत जा</Button>
        </Link>
      </Card>
    );
  }

  const allocatedPercent =
    farm.areaSqm > 0 ? Math.min(100, Math.round((farm.allocatedSqm / farm.areaSqm) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/farms"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{farm.farmName}</h1>
            <div className="flex items-center text-xs text-slate-500 space-x-2 mt-0.5">
              <span className="flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {farm.village}
                {farm.taluka && `, ${farm.taluka}`}
                {farm.district && `, ${farm.district}`}
              </span>
              {farm.surveyNumber && (
                <>
                  <span>•</span>
                  <span>गट नं: {farm.surveyNumber}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link to={`/farms/${farmId}/edit`}>
            <Button variant="secondary" size="sm">
              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
              बदल करा
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowArchiveConfirm(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            अर्काइव्ह
          </Button>
        </div>
      </div>

      {archiveError && <Alert variant="error">{archiveError}</Alert>}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <Card className="p-5 border-red-200 bg-red-50/50 space-y-3">
          <h3 className="font-bold text-red-900 text-sm">तुम्ही हे शेत अर्काइव्ह करू इच्छिता?</h3>
          <p className="text-xs text-red-700">
            शेत अर्काइव्ह केल्यास ते चालू यादीतून काढले जाईल. परंतु या शेतावरील सर्व तुकडे, पिके व कामांचा जुना इतिहास सुरक्षित राहील.
          </p>
          <div className="flex items-center space-x-3 pt-1">
            <Button
              variant="danger"
              size="sm"
              isLoading={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate()}
            >
              होय, अर्काइव्ह करा
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowArchiveConfirm(false)}
            >
              रद्द करा
            </Button>
          </div>
        </Card>
      )}

      {/* Area Breakdown Banner */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              एकूण क्षेत्रफळ (Total Farm Area)
            </span>
            <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {formatArea(farm.areaValue, farm.areaUnit, lang)}
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono bg-slate-50 px-3 py-2 rounded-lg">
            <div>
              <span className="text-slate-400 block text-[10px]">एकर</span>
              <span className="font-bold text-slate-800">{farm.breakdown?.acre} एकर</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">गुंठे</span>
              <span className="font-bold text-slate-800">{farm.breakdown?.guntha} गुंठे</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">हेक्टर</span>
              <span className="font-bold text-slate-800">{farm.breakdown?.hectare} हेक्टर</span>
            </div>
          </div>
        </div>

        {/* Allocation Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-700">
              प्लॉट वाटप: {farm.allocatedInUnit} {farm.areaUnit === 'acre' ? 'एकर' : farm.areaUnit} ({allocatedPercent}%)
            </span>
            <span className="text-emerald-700">
              शिल्लक: {farm.unallocatedInUnit} {farm.areaUnit === 'acre' ? 'एकर' : farm.areaUnit}
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                allocatedPercent >= 100 ? 'bg-amber-500' : 'bg-emerald-600'
              }`}
              style={{ width: `${allocatedPercent}%` }}
            />
          </div>
        </div>

        {farm.notes && (
          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="font-semibold text-slate-700">टीप:</span> {farm.notes}
          </p>
        )}
      </Card>

      {/* Plots Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Grid className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900">
              शेतजमिनीचे तुकडे / प्लॉट ({farm.plots?.length || 0})
            </h2>
          </div>
          {farm.unallocatedInUnit > 0.05 && (
            <Link to={`/farms/${farmId}/plots/new`}>
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                नवीन प्लॉट जोडा
              </Button>
            </Link>
          )}
        </div>

        {(!farm.plots || farm.plots.length === 0) ? (
          <Card className="text-center py-10 px-4 space-y-3 border-dashed border-2 border-slate-200">
            <p className="text-xs text-slate-500">या शेतात अद्याप कोणताही तुकडा / प्लॉट तयार केलेला नाही.</p>
            <Link to={`/farms/${farmId}/plots/new`}>
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                पहिला प्लॉट तयार करा
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {farm.plots.map((plot) => (
              <Card
                key={plot.id}
                className="p-4 hover:border-brand-green/60 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
                onClick={() => navigate(`/farms/${farmId}/plots/${plot.id}`)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base group-hover:text-brand-green transition-colors">
                        {plot.plotName}
                      </h3>
                      <span className="text-xs text-slate-500 font-mono">
                        {formatArea(plot.areaValue, plot.areaUnit, lang)}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        plot.cultivationMode === 'intercropping'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {plot.cultivationMode === 'intercropping'
                        ? 'आंतरपीक (Intercrop)'
                        : 'स्वतंत्र पीक (Separate)'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                    <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                    <span>सध्याची पिके:</span>
                    <span className="font-bold text-slate-800">{plot.activeCropCount ?? 0} पिके</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-brand-green font-semibold">
                  <span>प्लॉट सविस्तर पहा</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation Footer */}
      <div className="pt-2 flex flex-wrap gap-3">
        <Link to={`/crops/new?farmId=${farmId}`}>
          <Button variant="secondary" size="sm">
            <Sprout className="w-4 h-4 mr-1.5" />
            या शेतावर पीक नोंदवा
          </Button>
        </Link>
        <Link to={`/activities/new?farmId=${farmId}`}>
          <Button variant="secondary" size="sm">
            <ActivityIcon className="w-4 h-4 mr-1.5" />
            कामाची नोंद करा
          </Button>
        </Link>
      </div>
    </div>
  );
};
