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
  Sprout,
  Shuffle,
  Calendar,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

export const PlotDetailPage: React.FC = () => {
  const { farmId, plotId } = useParams<{ farmId: string; plotId: string }>();
  const { selectedGroup } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const lang = (i18n.language === 'en' ? 'en' : 'mr') as 'mr' | 'en';

  const groupId = selectedGroup?.id;
  const [actionError, setActionError] = useState<string | null>(null);
  const [showModeConfirm, setShowModeConfirm] = useState(false);

  const { data: plot, isLoading, error } = useQuery({
    queryKey: ['plot', groupId, plotId],
    queryFn: () => agricultureApi.getPlot(groupId!, plotId!),
    enabled: !!groupId && !!plotId,
  });

  const modeMutation = useMutation({
    mutationFn: (newMode: 'separate' | 'intercropping') =>
      agricultureApi.changeCultivationMode(groupId!, plotId!, newMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plot', groupId, plotId] });
      setShowModeConfirm(false);
      setActionError(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'लागवड पद्धत बदलता आली नाही.';
      setActionError(msg);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => agricultureApi.archivePlot(groupId!, plotId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm', groupId, farmId] });
      navigate(`/farms/${farmId}`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'प्लॉट अर्काइव्ह करता आला नाही.';
      setActionError(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error || !plot) {
    return (
      <Card className="text-center py-12 space-y-4">
        <Alert variant="error">प्लॉट आढळला नाही.</Alert>
        <Link to={`/farms/${farmId}`}>
          <Button variant="secondary">शेताकडे परत जा</Button>
        </Link>
      </Card>
    );
  }

  const isIntercropping = plot.cultivationMode === 'intercropping';
  const targetMode = isIntercropping ? 'separate' : 'intercropping';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to={`/farms/${farmId}`}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">{plot.plotName}</h1>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  isIntercropping
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {isIntercropping ? 'आंतरपीक (Intercrop)' : 'स्वतंत्र पीक (Separate)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              शेत: <span className="font-semibold text-slate-700">{plot.farmName}</span> ({plot.village})
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link to={`/farms/${farmId}/plots/${plotId}/edit`}>
            <Button variant="secondary" size="sm">
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              माहिती बदला
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (window.confirm('तुम्ही हा प्लॉट अर्काइव्ह करू इच्छिता? पिकांचा इतिहास सुरक्षित राहील.')) {
                archiveMutation.mutate();
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            अर्काइव्ह
          </Button>
        </div>
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {/* Mode Switch Card */}
      {showModeConfirm && (
        <Card className="p-4 border-amber-200 bg-amber-50/50 space-y-3">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-bold">
                लागवड पद्धत {isIntercropping ? 'स्वतंत्र (Separate)' : 'आंतरपीक (Intercropping)'} मध्ये बदलायची आहे का?
              </p>
              <p>
                {isIntercropping
                  ? 'स्वतंत्र मोडमध्ये एका वेळी एकच पीक घेता येते. जर प्लॉटवर आधीच अनेक पिके असतील तर पद्धत बदलता येणार नाही.'
                  : 'आंतरपीक मोडमध्ये तुम्ही या एकाच प्लॉटवर ऊस + सोयाबीन अशी एकापेक्षा जास्त पिके एकत्र नोंदवू शकाल.'}
              </p>
            </div>
          </div>
          <div className="flex space-x-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              isLoading={modeMutation.isPending}
              onClick={() => modeMutation.mutate(targetMode)}
            >
              होय, पद्धत बदला
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowModeConfirm(false)}>
              रद्द करा
            </Button>
          </div>
        </Card>
      )}

      {/* Area & Details Card */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
              प्लॉट क्षेत्रफळ (Physical Area)
            </span>
            <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {formatArea(plot.areaValue, plot.areaUnit, lang)}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowModeConfirm(!showModeConfirm)}
            >
              <Shuffle className="w-3.5 h-3.5 mr-1 text-slate-500" />
              लागवड पद्धत बदला
            </Button>
          </div>
        </div>

        {isIntercropping && (
          <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-center space-x-2">
            <span className="text-base">ℹ️</span>
            <span>
              <strong>आंतरपीक नियम:</strong> या प्लॉटवर एकाच वेळी अनेक पिके असू शकतात. पिकांची संख्या कितीही असली तरी शेताच्या एकूण हिशोबात या प्लॉटचे मूळ क्षेत्र ({formatArea(plot.areaValue, plot.areaUnit, lang)}) केवळ एकदाच मोजले जाते.
            </span>
          </div>
        )}

        {plot.notes && (
          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="font-semibold text-slate-700">टीप:</span> {plot.notes}
          </p>
        )}
      </Card>

      {/* Crops on this Plot Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sprout className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900">
              या प्लॉटवरील पिके ({plot.crops?.length || 0})
            </h2>
          </div>
          <Link to={`/crops/new?farmId=${farmId}&plotId=${plotId}`}>
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              नवीन पीक लावा
            </Button>
          </Link>
        </div>

        {(!plot.crops || plot.crops.length === 0) ? (
          <Card className="text-center py-10 px-4 space-y-3 border-dashed border-2 border-slate-200">
            <p className="text-xs text-slate-500">या प्लॉटवर अद्याप कोणतेही पीक नोंदवलेले नाही.</p>
            <Link to={`/crops/new?farmId=${farmId}&plotId=${plotId}`}>
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                पहिले पीक नोंदवा
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plot.crops.map((crop) => (
              <Card
                key={crop.id}
                className="p-4 hover:border-brand-green/60 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
                onClick={() => navigate(`/crops/${crop.id}`)}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-brand-green transition-colors">
                        {crop.cropNameCustom || crop.cropNameMr}
                      </h3>
                      <span className="text-xs text-slate-500">
                        {crop.cropNameMr} • {crop.seasonNameMr}
                      </span>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        crop.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : crop.status === 'planned'
                          ? 'bg-amber-100 text-amber-800'
                          : crop.status === 'harvested'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {crop.status === 'active'
                        ? 'चालू (Active)'
                        : crop.status === 'planned'
                        ? 'नियोजित (Planned)'
                        : crop.status === 'harvested'
                        ? 'काढणी झाली'
                        : 'रद्द'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2 rounded">
                    <div className="flex items-center text-slate-500">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      <span>पेरणी तारीख: <strong className="text-slate-800">{crop.sowingDate}</strong></span>
                    </div>
                    {crop.expectedHarvestDate && (
                      <div className="text-slate-500">
                        अपेक्षित काढणी: <strong className="text-slate-800">{crop.expectedHarvestDate}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-brand-green font-semibold">
                  <span>पिकाची माहिती पहा</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
