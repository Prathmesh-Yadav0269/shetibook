import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { dashboardApi } from '../services/dashboardApi';
import { DashboardData } from '../types';
import { formatPaise } from '../../../utils/finance';
import {
  Grid,
  Sprout,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Wallet,
  Layers,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');

  const fetchDashboard = async () => {
    if (!selectedGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await dashboardApi.getDashboard(selectedGroup.id, {
        farmId: selectedFarmId || undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'डॅशबोर्ड डेटा लोड करताना त्रुटी आली.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedGroup?.id, selectedFarmId]);

  const activityStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            सुरू आहे
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" />
            प्रलंबित
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            थांबवले
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            पूर्ण
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600 font-medium text-sm">शेतीबुक डॅशबोर्ड माहिती तयार होत आहे...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Group Selector / Farm Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              शेती डॅशबोर्ड (Dashboard)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {selectedGroup?.name}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            तुमची शेती, पिके, दैनंदिन कामे आणि आर्थिक नफा-तोटा यांचा थेट सारांश.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {data && data.farms.list.length > 0 && (
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 font-medium text-slate-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/20"
            >
              <option value="">सर्व शेती (All Farms)</option>
              {data.farms.list.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmName} ({f.village})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={fetchDashboard}
            title="रिफ्रेश करा"
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          {/* Main 4 KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Farms */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-600">एकूण शेती व क्षेत्र</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Grid className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900">{data.farms.total} <span className="text-xs font-normal text-slate-500">शेत/जमीन</span></div>
                <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">{data.farms.totalAreaBreakdown.acre} एकर {data.farms.totalAreaBreakdown.guntha} गुंठे</span>
                  <span className="text-slate-400">|</span>
                  <span>{data.farms.totalAreaBreakdown.hectare} हेक्टर</span>
                </div>
              </div>
              <Link
                to="/farms"
                className="mt-3 text-[11px] font-semibold text-brand-green hover:underline flex items-center gap-1"
              >
                तपशील पहा &rarr;
              </Link>
            </div>

            {/* Card 2: Crops */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-600">पिके (Crops)</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Sprout className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900">{data.crops.activeCount} <span className="text-xs font-normal text-slate-500">सक्रिय पिके</span></div>
                <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-2">
                  <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                    {data.crops.plannedCount} नियोजित
                  </span>
                  <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                    {data.crops.harvestedCount} काढणी झालेली
                  </span>
                </div>
              </div>
              <Link
                to="/crops"
                className="mt-3 text-[11px] font-semibold text-brand-green hover:underline flex items-center gap-1"
              >
                पिके व्यवस्थापन &rarr;
              </Link>
            </div>

            {/* Card 3: Activities */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-600">कामे व उपक्रम</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900">
                  {data.activities.counts.inProgress}{' '}
                  <span className="text-xs font-normal text-slate-500">सुरू कामे</span>
                </div>
                <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-2">
                  <span>{data.activities.counts.pending} प्रलंबित</span>
                  <span>•</span>
                  <span>{data.activities.counts.completed} पूर्ण</span>
                </div>
              </div>
              <Link
                to="/activities"
                className="mt-3 text-[11px] font-semibold text-brand-green hover:underline flex items-center gap-1"
              >
                कामे पहा &rarr;
              </Link>
            </div>

            {/* Card 4: Net Profit */}
            <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs flex flex-col justify-between ${
              data.financial.netProfitPaise >= 0
                ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200/80'
                : 'bg-gradient-to-br from-red-50 to-white border-red-200/80'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-700">अंदाजे निव्वळ नफा</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  data.financial.netProfitPaise >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className={`text-2xl font-bold tracking-tight ${
                  data.financial.netProfitPaise >= 0 ? 'text-emerald-800' : 'text-red-700'
                }`}>
                  {formatPaise(data.financial.netProfitPaise)}
                </div>
                <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5">
                  <span className="text-emerald-700 font-medium">विक्री: {formatPaise(data.financial.totalSalesPaise)}</span>
                  <span>|</span>
                  <span className="text-red-600 font-medium">खर्च: {formatPaise(data.financial.totalExpensesPaise)}</span>
                </div>
              </div>
              <Link
                to="/finance/summary"
                className="mt-3 text-[11px] font-semibold text-emerald-800 hover:underline flex items-center gap-1"
              >
                नफा-तोटा अहवाल &rarr;
              </Link>
            </div>
          </div>

          {/* Cultivated Area vs Total Land Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-green" />
                <h3 className="text-sm font-bold text-slate-800">लागवड क्षेत्र वितरण (Cultivated Area)</h3>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {data.farms.cultivatedAreaBreakdown.acre} एकर लागवडीखाली / {data.farms.totalAreaBreakdown.acre} एकर एकूण
              </span>
            </div>
            {data.farms.totalAreaSqm > 0 ? (
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-brand-green h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((data.farms.cultivatedAreaSqm / data.farms.totalAreaSqm) * 100)
                    )}%`,
                  }}
                  title="लागवडीखालील क्षेत्र"
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-medium">
              <span>लागवड: {data.farms.cultivatedAreaBreakdown.acre} एकर ({data.farms.cultivatedAreaBreakdown.guntha} गुंठे)</span>
              <span>शिल्लक/इतर: {(data.farms.totalAreaBreakdown.acre - data.farms.cultivatedAreaBreakdown.acre).toFixed(2)} एकर</span>
            </div>
          </div>

          {/* Financial Cash Flow Breakdown Strip */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-800">रोख प्रवाह व उधारी स्थिती (Cash Flow & Balances)</h3>
              </div>
              <Link
                to="/reports"
                className="text-xs font-semibold text-brand-green hover:underline"
              >
                सविस्तर अहवाल पहा &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-medium text-slate-500">जमा झालेली रक्कम</span>
                <p className="text-base font-bold text-emerald-700 mt-1">
                  {formatPaise(data.financial.totalSalesReceivedPaise)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-medium text-slate-500">खर्चापोटी दिलेली रक्कम</span>
                <p className="text-base font-bold text-slate-800 mt-1">
                  {formatPaise(data.financial.totalExpensesPaidPaise)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="text-[11px] font-medium text-blue-700">येणे बाकी (व्यापाऱ्यांकडून)</span>
                <p className="text-base font-bold text-blue-800 mt-1">
                  {formatPaise(data.financial.pendingReceivablesPaise)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-[11px] font-medium text-amber-700">देणे बाकी (दुकानदारांना)</span>
                <p className="text-base font-bold text-amber-800 mt-1">
                  {formatPaise(data.financial.pendingPayablesPaise)}
                </p>
              </div>
            </div>
          </div>

          {/* Grid Layout: Active Crops & Recent Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Active Crops List */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-emerald-700" />
                  <h3 className="font-bold text-slate-900 text-base">सध्याची शेतातील पिके (Active Crops)</h3>
                </div>
                <Link
                  to="/crops/new"
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  नवीन पीक
                </Link>
              </div>

              {data.crops.list.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  सध्या कोणतेही सक्रिय पीक नोंदवलेले नाही.
                </div>
              ) : (
                <div className="space-y-3 flex-1">
                  {data.crops.list.map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 transition-colors bg-slate-50/50 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{c.cropNameMr}</span>
                          {c.variety && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-medium">
                              {c.variety}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {c.farmName} • {c.plotName}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-700 block">
                          पेरणी: {c.sowingDate}
                        </span>
                        <Link
                          to={`/crops/${c.id}`}
                          className="text-[11px] font-semibold text-brand-green hover:underline mt-0.5 inline-block"
                        >
                          तपशील &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Recent Live Activities */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-700" />
                  <h3 className="font-bold text-slate-900 text-base">अलीकडील कामे (Recent Activities)</h3>
                </div>
                <Link
                  to="/activities/new"
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  काम जोडा
                </Link>
              </div>

              {data.activities.recent.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  कोणतीही शेती कामे नोंदवलेली नाहीत.
                </div>
              ) : (
                <div className="space-y-3 flex-1">
                  {data.activities.recent.map((a) => (
                    <div
                      key={a.id}
                      className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 transition-colors bg-slate-50/50 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {a.customName || a.activityTypeMr}
                          </span>
                          {activityStatusBadge(a.status)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {a.farmName} {a.cropNameMr ? `• ${a.cropNameMr}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">
                          {new Date(a.createdAt).toLocaleDateString('mr-IN')}
                        </span>
                        <Link
                          to={`/activities/${a.id}`}
                          className="text-[11px] font-semibold text-brand-green hover:underline mt-0.5 inline-block"
                        >
                          अद्यतन करा &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
