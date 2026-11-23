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
  Play,
  Pause,
  CheckCircle,
  XCircle,
  History,
} from 'lucide-react';

export const ActivityDetailPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const { selectedGroup } = useAuth();
  const queryClient = useQueryClient();
  const groupId = selectedGroup?.id;

  const [transitionNotes, setTransitionNotes] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: activity, isLoading, error } = useQuery({
    queryKey: ['activity', groupId, activityId],
    queryFn: () => agricultureApi.getActivity(groupId!, activityId!),
    enabled: !!groupId && !!activityId,
  });

  const transitionMutation = useMutation({
    mutationFn: (transition: 'start' | 'pause' | 'resume' | 'complete' | 'cancel') =>
      agricultureApi.transitionActivity(groupId!, activityId!, transition, transitionNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', groupId, activityId] });
      setTransitionNotes('');
      setActionError(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'कृती करण्यात त्रुटी आली.';
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

  if (error || !activity) {
    return (
      <Card className="text-center py-12 space-y-4">
        <Alert variant="error">काम आढळले नाही.</Alert>
        <Link to="/activities">
          <Button variant="secondary">कामांच्या यादीकडे परत जा</Button>
        </Link>
      </Card>
    );
  }

  const eventLabel = (type: string) => {
    switch (type) {
      case 'created':
        return 'काम नोंदवले गेले (Created)';
      case 'started':
        return 'काम सुरू केले (Started)';
      case 'paused':
        return 'काम थांबवले (Paused)';
      case 'resumed':
        return 'काम पुन्हा सुरू केले (Resumed)';
      case 'completed':
        return 'काम यशस्वीरीत्या पूर्ण झाले (Completed)';
      case 'cancelled':
        return 'काम रद्द केले (Cancelled)';
      default:
        return type;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/activities"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {activity.customActivityName || activity.activityNameMr}
              </h1>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  activity.status === 'in_progress'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activity.status === 'paused'
                    ? 'bg-amber-100 text-amber-800'
                    : activity.status === 'completed'
                    ? 'bg-blue-100 text-blue-800'
                    : activity.status === 'pending'
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {activity.status === 'in_progress'
                  ? 'चालू (In Progress)'
                  : activity.status === 'paused'
                  ? 'थांबलेले (Paused)'
                  : activity.status === 'completed'
                  ? 'पूर्ण झाले (Completed)'
                  : activity.status === 'pending'
                  ? 'प्रलंबित (Pending)'
                  : 'रद्द'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              प्रकार: <strong className="text-slate-700">{activity.activityNameMr}</strong> ({activity.activityNameEn})
            </p>
          </div>
        </div>
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {/* Transition Action Card */}
      {activity.status !== 'completed' && activity.status !== 'cancelled' && (
        <Card className="p-4 bg-slate-50 border-slate-200 space-y-3">
          <div className="text-xs font-semibold text-slate-700">
            कामाची स्थिती बदला (Activity Transition):
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="कामाबाबत टीप (उदा. सकाळी काम सुरू, ५ पोती खत टाकले...)"
              value={transitionNotes}
              onChange={(e) => setTransitionNotes(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-green"
            />

            <div className="flex items-center space-x-2">
              {activity.status === 'pending' && (
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={transitionMutation.isPending}
                  onClick={() => transitionMutation.mutate('start')}
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  काम सुरू करा
                </Button>
              )}

              {activity.status === 'in_progress' && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={transitionMutation.isPending}
                    onClick={() => transitionMutation.mutate('pause')}
                  >
                    <Pause className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    थांबवा (Pause)
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={transitionMutation.isPending}
                    onClick={() => transitionMutation.mutate('complete')}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    पूर्ण झाले (Complete)
                  </Button>
                </>
              )}

              {activity.status === 'paused' && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={transitionMutation.isPending}
                    onClick={() => transitionMutation.mutate('resume')}
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    पुन्हा सुरू करा
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={transitionMutation.isPending}
                    onClick={() => transitionMutation.mutate('complete')}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    पूर्ण झाले
                  </Button>
                </>
              )}

              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm('तुम्ही हे काम रद्द करू इच्छिता?')) {
                    transitionMutation.mutate('cancel');
                  }
                }}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                रद्द करा
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Info Details */}
      <Card className="p-4 space-y-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
          कामाचे ठिकाण व संदर्भ
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-lg space-y-0.5">
            <span className="text-slate-500 block">शेत:</span>
            <Link to={`/farms/${activity.farmId}`} className="font-bold text-slate-900 hover:text-brand-green">
              {activity.farmName} ({activity.village})
            </Link>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg space-y-0.5">
            <span className="text-slate-500 block">तुकडा / प्लॉट:</span>
            <span className="font-bold text-slate-900">
              {activity.plotName || 'संपूर्ण शेत'}
            </span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg space-y-0.5">
            <span className="text-slate-500 block">संबंधित पीक:</span>
            <span className="font-bold text-slate-900">
              {activity.cropNameMr || 'कोणतेही विशिष्ट नाही'}
            </span>
          </div>
        </div>

        {activity.description && (
          <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <strong className="text-slate-900">वर्णन:</strong> {activity.description}
          </p>
        )}
      </Card>

      {/* Activity Timeline / Event Log */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-emerald-700" />
          <h2 className="text-lg font-bold text-slate-900">कामाचा इतिहास व टाईमलाईन (Timeline)</h2>
        </div>

        <Card className="p-5">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {activity.events?.map((evt) => (
              <div key={evt.id} className="relative space-y-1">
                <div
                  className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                    evt.eventType === 'completed'
                      ? 'bg-blue-600'
                      : evt.eventType === 'started' || evt.eventType === 'resumed'
                      ? 'bg-emerald-600'
                      : evt.eventType === 'paused'
                      ? 'bg-amber-600'
                      : 'bg-slate-400'
                  }`}
                />

                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{eventLabel(evt.eventType)}</span>
                  <span className="text-slate-400 font-mono text-[11px]">{evt.eventAt}</span>
                </div>

                <div className="text-xs text-slate-500 flex items-center space-x-2">
                  <span>नोंदकर्ता: {evt.actorPhoneEnding ? `*****${evt.actorPhoneEnding}` : 'कुटुंब सदस्य'}</span>
                </div>

                {evt.notes && (
                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                    {evt.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
