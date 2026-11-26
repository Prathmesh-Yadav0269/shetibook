import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { notificationApi } from '../services/notificationApi';
import { InAppNotification } from '../types';
import {
  Bell,
  Check,
  CheckCheck,
  Settings,
  AlertCircle,
  Activity,
  DollarSign,
  Users,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterUnread, setFilterUnread] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!selectedGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await notificationApi.getNotifications(selectedGroup.id, filterUnread);
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch (err: any) {
      setError(err?.message || 'सूचना लोड करताना त्रुटी आली.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [selectedGroup?.id, filterUnread]);

  const handleMarkAsRead = async (id: string) => {
    if (!selectedGroup) return;
    try {
      await notificationApi.markAsRead(selectedGroup.id, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!selectedGroup) return;
    try {
      await notificationApi.markAllAsRead(selectedGroup.id);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err: any) {
      alert(err?.message || 'सर्व सूचना वाचल्या म्हणून चिन्हांकित करणे अयशस्वी.');
    }
  };

  const getIcon = (type: string) => {
    if (type.includes('activity')) return <Activity className="w-5 h-5 text-blue-600" />;
    if (type.includes('payment') || type.includes('expense'))
      return <DollarSign className="w-5 h-5 text-emerald-600" />;
    return <Users className="w-5 h-5 text-amber-600" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              सूचना केंद्र (Notifications)
            </h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                {unreadCount} न वाचलेल्या
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            शेती कामांचे स्मरणपत्रे, कौटुंबिक सूचना आणि महत्त्वाचे अलर्ट.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              सर्व वाचले म्हणून चिन्हांकित करा
            </button>
          )}

          <Link
            to="/notifications/preferences"
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="सूचना सेटिंग्ज"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterUnread(false)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            !filterUnread ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          सर्व सूचना
        </button>
        <button
          type="button"
          onClick={() => setFilterUnread(true)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            filterUnread ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          फक्त न वाचलेल्या
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] space-y-3">
          <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 text-xs">सूचना लोड होत आहेत...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">कोणतीही सूचना उपलब्ध नाही</h3>
          <p className="text-xs text-slate-500 mt-1">सर्व कामे सुरळीत आहेत!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-2xl border transition-colors flex items-start gap-3.5 ${
                n.isRead
                  ? 'bg-white border-slate-200/80 opacity-80'
                  : 'bg-emerald-50/40 border-emerald-200 shadow-xs'
              }`}
            >
              <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-xs">
                {getIcon(n.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">{n.title}</h4>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(n.createdAt).toLocaleTimeString('mr-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
              </div>

              {!n.isRead && (
                <button
                  type="button"
                  onClick={() => handleMarkAsRead(n.id)}
                  title="वाचले म्हणून चिन्हांकित करा"
                  className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
