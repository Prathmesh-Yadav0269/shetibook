import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { notificationApi } from '../services/notificationApi';
import { NotificationPreferences } from '../types';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  Activity,
  DollarSign,
} from 'lucide-react';

export const NotificationPreferencesPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    activityReminders: true,
    familyEscalations: true,
    financialAlerts: true,
    pushEnabled: true,
  });
  const [, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGroup) return;
    notificationApi
      .getPreferences(selectedGroup.id)
      .then((res) => {
        setPrefs(res);
      })
      .catch((err) => {
        setError(err?.message || 'प्राधान्ये लोड करताना त्रुटी आली.');
      })
      .finally(() => setIsLoading(false));
  }, [selectedGroup?.id]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!selectedGroup) return;
    try {
      setIsSaving(true);
      setError(null);
      setMessage(null);
      await notificationApi.updatePreferences(selectedGroup.id, prefs);
      setMessage('सूचना प्राधान्ये यशस्वीरीत्या जतन केली!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'प्राधान्ये जतन करताना त्रुटी आली.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/notifications"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          सूचना केंद्राकडे परत जा
        </Link>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            सूचना प्राधान्ये (Notification Preferences)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            तुम्हाला कोणत्या प्रकारच्या सूचना आणि स्मरणपत्रे मिळावीत ते नियंत्रित करा.
          </p>
        </div>

        {message && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {/* Toggle 1: Activity Reminders */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700 mt-0.5">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">शेती काम स्मरणपत्रे</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  सुरू केलेल्या कामांची वेळ पूर्ण होत आल्यास २ तास व ३० मिनिटे आधी येणारे अलर्ट.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.activityReminders}
                onChange={() => handleToggle('activityReminders')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
            </label>
          </div>

          {/* Toggle 2: Family Escalation */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">कौटुंबिक एस्केलेशन सूचना</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  एखादे काम वेळेत पूर्ण न झाल्यास कुटुंबातील इतर सदस्यांना सावध करणारी सूचना.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.familyEscalations}
                onChange={() => handleToggle('familyEscalations')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
            </label>
          </div>

          {/* Toggle 3: Financial Alerts */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 mt-0.5">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">आर्थिक व्यवहार अलर्ट</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  कुटुंबातील सदस्याने नवीन खर्च किंवा विक्री नोंदवल्यास त्वरित मिळणारी सूचना.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.financialAlerts}
                onChange={() => handleToggle('financialAlerts')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-green hover:bg-brand-green-hover text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'जतन करत आहे...' : 'प्राधान्ये जतन करा'}
          </button>
        </div>
      </div>
    </div>
  );
};
