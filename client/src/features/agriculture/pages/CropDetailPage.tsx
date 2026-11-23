import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../app/providers/AuthProvider';
import { agricultureApi } from '../services/agricultureApi';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import {
  ArrowLeft,
  Edit2,
  CheckCircle2,
  Play,
  XCircle,
  Plus,
  Activity as ActivityIcon,
} from 'lucide-react';

export const CropDetailPage: React.FC = () => {
  const { cropId } = useParams<{ cropId: string }>();
  const { selectedGroup } = useAuth();
  const queryClient = useQueryClient();
  const groupId = selectedGroup?.id;

  const [harvestDateInput, setHarvestDateInput] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: crop, isLoading, error } = useQuery({
    queryKey: ['crop', groupId, cropId],
    queryFn: () => agricultureApi.getCrop(groupId!, cropId!),
    enabled: !!groupId && !!cropId,
  });

  const statusMutation = useMutation({
    mutationFn: ({
      status,
      actualHarvestDate,
    }: {
      status: 'planned' | 'active' | 'harvested' | 'cancelled';
      actualHarvestDate?: string | null;
    }) => agricultureApi.changeCropStatus(groupId!, cropId!, status, actualHarvestDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop', groupId, cropId] });
      setShowHarvestModal(false);
      setActionError(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'स्थिती बदलण्यात त्रुटी आली.';
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

  if (error || !crop) {
    return (
      <Card className="text-center py-12 space-y-4">
        <Alert variant="error">पीक माहिती आढळली नाही.</Alert>
        <Link to="/crops">
          <Button variant="secondary">पिकांच्या यादीकडे परत जा</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/crops"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {crop.cropNameCustom || crop.cropNameMr}
              </h1>
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
                  ? 'काढणी झालेली'
                  : 'रद्द'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              प्रकार: <strong className="text-slate-700">{crop.cropNameMr}</strong> ({crop.cropNameEn}) • हंगाम: <strong className="text-slate-700">{crop.seasonNameMr}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link to={`/crops/${cropId}/edit`}>
            <Button variant="secondary" size="sm">
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              माहिती बदला
            </Button>
          </Link>
        </div>
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {/* Harvest Modal */}
      {showHarvestModal && (
        <Card className="p-4 border-blue-200 bg-blue-50/50 space-y-3">
          <h3 className="font-bold text-blue-900 text-sm">काढणी तारीख नोंदवा</h3>
          <p className="text-xs text-blue-700">
            या पिकाची काढणी पूर्ण झाली आहे असे नोंदवण्यासाठी काढणी तारीख निवडा.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 max-w-xs">
            <input
              type="date"
              value={harvestDateInput}
              onChange={(e) => setHarvestDateInput(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
            />
            <Button
              variant="primary"
              size="sm"
              isLoading={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({
                  status: 'harvested',
                  actualHarvestDate: harvestDateInput,
                })
              }
            >
              नोंदवा
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowHarvestModal(false)}>
              रद्द करा
            </Button>
          </div>
        </Card>
      )}

      {/* Status Transition Action Bar */}
      <Card className="p-4 bg-slate-50 border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600">
          पिकाची सद्य स्थिती बदला:
        </span>
        <div className="flex items-center space-x-2">
          {crop.status === 'planned' && (
            <Button
              variant="primary"
              size="sm"
              isLoading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ status: 'active' })}
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              पीक सुरू करा (Mark Active)
            </Button>
          )}

          {crop.status === 'active' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowHarvestModal(true)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              काढणी नोंदवा (Harvested)
            </Button>
          )}

          {crop.status !== 'cancelled' && crop.status !== 'harvested' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (window.confirm('तुम्ही हे पीक रद्द करू इच्छिता?')) {
                  statusMutation.mutate({ status: 'cancelled' });
                }
              }}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              पीक रद्द करा
            </Button>
          )}
        </div>
      </Card>

      {/* Location and Dates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Farm & Plot Location */}
        <Card className="p-4 space-y-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            शेत व प्लॉट माहिती
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">शेत:</span>
              <Link to={`/farms/${crop.farmId}`} className="font-bold text-brand-green hover:underline">
                {crop.farmName} ({crop.village})
              </Link>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">तुकडा / प्लॉट:</span>
              <Link to={`/farms/${crop.farmId}/plots/${crop.plotId}`} className="font-bold text-brand-green hover:underline">
                {crop.plotName}
              </Link>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">लागवड पद्धत:</span>
              <span className="font-semibold text-slate-800">
                {crop.cultivationMode === 'intercropping' ? 'आंतरपीक (Intercropping)' : 'स्वतंत्र पीक (Separate)'}
              </span>
            </div>
          </div>
        </Card>

        {/* Dates */}
        <Card className="p-4 space-y-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            महत्वाच्या तारखा
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">पेरणी / लागवड:</span>
              <span className="font-bold text-slate-800">{crop.sowingDate}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">अपेक्षित काढणी:</span>
              <span className="font-semibold text-slate-800">
                {crop.expectedHarvestDate || 'नोंद नाही'}
              </span>
            </div>
            {crop.actualHarvestDate && (
              <div className="flex justify-between py-1">
                <span className="text-slate-500">प्रत्यक्ष काढणी तारीख:</span>
                <span className="font-bold text-blue-700">{crop.actualHarvestDate}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {crop.notes && (
        <Card className="p-4 text-xs text-slate-700 space-y-1">
          <span className="font-semibold text-slate-900 block">टीप:</span>
          <p>{crop.notes}</p>
        </Card>
      )}

      {/* Associated Activities */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ActivityIcon className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900">या पिकाची कामे / उपक्रम</h2>
          </div>
          <Link to={`/activities/new?farmId=${crop.farmId}&cropId=${crop.id}`}>
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              काम जोडा
            </Button>
          </Link>
        </div>

        {/* Activities List */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            या पिकाशी संबंधित कामांची नोंद पाहण्यासाठी व नवीन काम जोडण्यासाठी वरील बटनाचा वापर करा.
          </p>
        </div>
      </div>
    </div>
  );
};
