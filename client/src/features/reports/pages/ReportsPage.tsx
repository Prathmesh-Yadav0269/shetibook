import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { reportsApi } from '../services/reportsApi';
import {
  FarmReportItem,
  CropReportItem,
  MonthlyTrendItem,
  CategoryBreakdownItem,
} from '../types';
import { formatPaise } from '../../../utils/finance';
import {
  FileText,
  BarChart2,
  Sprout,
  Grid,
  PieChart,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

type ReportTab = 'farms' | 'crops' | 'monthly' | 'categories';

export const ReportsPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('crops');

  const [farmReports, setFarmReports] = useState<FarmReportItem[]>([]);
  const [cropReports, setCropReports] = useState<CropReportItem[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrendItem[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdownItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentTab = async () => {
    if (!selectedGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      if (activeTab === 'farms') {
        const data = await reportsApi.getFarmReports(selectedGroup.id);
        setFarmReports(data);
      } else if (activeTab === 'crops') {
        const data = await reportsApi.getCropReports(selectedGroup.id);
        setCropReports(data);
      } else if (activeTab === 'monthly') {
        const data = await reportsApi.getMonthlyTrends(selectedGroup.id);
        setMonthlyTrends(data);
      } else if (activeTab === 'categories') {
        const data = await reportsApi.getCategoryBreakdown(selectedGroup.id);
        setCategories(data);
      }
    } catch (err: any) {
      setError(err?.message || 'अहवाल माहिती लोड करताना त्रुटी आली.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentTab();
  }, [selectedGroup?.id, activeTab]);

  const handleExport = async (dataset: 'expenses' | 'sales' | 'harvests' | 'farms') => {
    if (!selectedGroup) return;
    try {
      setIsExporting(true);
      await reportsApi.exportCsv(selectedGroup.id, dataset);
    } catch (err: any) {
      alert(err?.message || 'CSV डाऊनलोड अयशस्वी.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              कृषी व आर्थिक अहवाल (Reports)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            शेती, पिके, मासिक नफा-तोटा आणि खर्चांचे सविस्तर विश्लेषण व एक्सेल/CSV निर्यात.
          </p>
        </div>

        {/* CSV Export Dropdown / Button */}
        <div className="flex items-center gap-2">
          <div className="relative inline-block text-left">
            <select
              disabled={isExporting}
              onChange={(e) => {
                if (e.target.value) {
                  handleExport(e.target.value as any);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <option value="" disabled>
                {isExporting ? 'डाउनलोड होत आहे...' : '📥 अहवाल डाऊनलोड (CSV)'}
              </option>
              <option value="expenses">खर्च अहवाल (Expenses CSV)</option>
              <option value="sales">विक्री अहवाल (Sales CSV)</option>
              <option value="harvests">काढणी अहवाल (Harvests CSV)</option>
              <option value="farms">शेत माहिती (Farms CSV)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={fetchCurrentTab}
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

      {/* Tabs */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('crops')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'crops'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Sprout className="w-4 h-4" />
          पीकनिहाय अहवाल
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('farms')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'farms'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Grid className="w-4 h-4" />
          शेतनिहाय अहवाल
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'monthly'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          महिनानिहाय कल (Trends)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <PieChart className="w-4 h-4" />
          खर्च वर्गीकरण
        </button>
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 text-xs font-medium">अहवाल तयार होत आहे...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: Crops Report */}
          {activeTab === 'crops' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">प्रत्येक पिकाचा नफा-तोटा हिशोब</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    प्रत्येक पिकाचा प्रत्यक्ष खर्च, विक्री महसूल आणि शिल्लक निव्वळ नफा
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                  एकूण: {cropReports.length} पिके
                </span>
              </div>

              {cropReports.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">कोणतीही पिके नोंदवलेली नाहीत.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4">पीक व वाण</th>
                        <th className="py-3 px-4">शेत व तुकडा</th>
                        <th className="py-3 px-4">हंगाम</th>
                        <th className="py-3 px-4 text-right">वाटप केलेला खर्च</th>
                        <th className="py-3 px-4 text-right">विक्री उत्पन्न</th>
                        <th className="py-3 px-4 text-right">निव्वळ नफा/तोटा</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cropReports.map((c) => {
                        const isProfitable = c.netProfitPaise >= 0;
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{c.cropNameMr}</div>
                              {c.variety && <div className="text-xs text-slate-500">{c.variety}</div>}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              <div>{c.farmName}</div>
                              <div className="text-xs text-slate-500">{c.plotName}</div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-medium">
                              {c.seasonNameMr}
                            </td>
                            <td className="py-3.5 px-4 text-right font-semibold text-red-600">
                              {formatPaise(c.allocatedExpensePaise)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-semibold text-emerald-700">
                              {formatPaise(c.salesRevenuePaise)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span
                                className={`inline-flex items-center gap-1 font-bold ${
                                  isProfitable ? 'text-emerald-800' : 'text-red-700'
                                }`}
                              >
                                {isProfitable ? (
                                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                                )}
                                {formatPaise(c.netProfitPaise)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Farms Report */}
          {activeTab === 'farms' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">शेतनिहाय आर्थिक अहवाल</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    प्रत्येक शेताचे एकूण क्षेत्र, सक्रिय पिके, एकूण खर्च आणि उत्पन्न
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                  एकूण: {farmReports.length} शेते
                </span>
              </div>

              {farmReports.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">कोणतीही शेती नोंदवलेली नाही.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4">शेत नाव व पत्ता</th>
                        <th className="py-3 px-4">क्षेत्र</th>
                        <th className="py-3 px-4 text-center">सक्रिय पिके</th>
                        <th className="py-3 px-4 text-right">एकूण खर्च</th>
                        <th className="py-3 px-4 text-right">एकूण विक्री</th>
                        <th className="py-3 px-4 text-right">निव्वळ नफा</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {farmReports.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{f.farmName}</div>
                            <div className="text-xs text-slate-500">
                              {f.village}, {f.taluka} {f.surveyNumber ? `(सर्व्हे: ${f.surveyNumber})` : ''}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-700">
                            {f.areaBreakdown.acre} एकर {f.areaBreakdown.guntha} गुंठे
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
                              {f.activeCrops}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-red-600">
                            {formatPaise(f.totalExpensePaise)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-700">
                            {formatPaise(f.totalSalesPaise)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {formatPaise(f.netProfitPaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Monthly Trends */}
          {activeTab === 'monthly' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="mb-6">
                  <h3 className="font-bold text-slate-900 text-base">महिनानिहाय उत्पन्न व खर्च कल</h3>
                  <p className="text-xs text-slate-500 mt-0.5">मागील महिन्यांमधील शेती खर्च आणि विक्री महसूल तुलना</p>
                </div>

                {monthlyTrends.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    अद्याप मासिक डेटा उपलब्ध नाही.
                  </div>
                ) : (
                  <div>
                    {/* Visual SVG Bar Graph */}
                    <div className="h-64 w-full flex items-end gap-3 sm:gap-6 border-b border-slate-200 pb-2 px-2">
                      {monthlyTrends.map((m) => {
                        const maxVal = Math.max(
                          ...monthlyTrends.map((x) => Math.max(x.salesPaise, x.expensePaise, 1))
                        );
                        const salesHeight = Math.round((m.salesPaise / maxVal) * 200);
                        const expenseHeight = Math.round((m.expensePaise / maxVal) * 200);

                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                            <div className="w-full flex items-end justify-center gap-1.5 h-52">
                              {/* Expense bar */}
                              <div
                                style={{ height: `${Math.max(expenseHeight, 4)}px` }}
                                className="w-1/2 max-w-[28px] bg-red-400 group-hover:bg-red-500 rounded-t transition-all"
                                title={`खर्च: ${formatPaise(m.expensePaise)}`}
                              />
                              {/* Sales bar */}
                              <div
                                style={{ height: `${Math.max(salesHeight, 4)}px` }}
                                className="w-1/2 max-w-[28px] bg-emerald-500 group-hover:bg-emerald-600 rounded-t transition-all"
                                title={`विक्री: ${formatPaise(m.salesPaise)}`}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-600 mt-2 rotate-[-25deg] sm:rotate-0 origin-top-left">
                              {m.month}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Chart Legend */}
                    <div className="flex items-center justify-center gap-6 mt-6 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" />
                        <span className="text-slate-700">विक्री उत्पन्न (Sales)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded bg-red-400 inline-block" />
                        <span className="text-slate-700">शेती खर्च (Expenses)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Table */}
              {monthlyTrends.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4">महिना</th>
                        <th className="py-3 px-4 text-right">खर्च</th>
                        <th className="py-3 px-4 text-right">विक्री</th>
                        <th className="py-3 px-4 text-right">नफा/तोटा</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyTrends.map((m) => (
                        <tr key={m.month} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-800">{m.month}</td>
                          <td className="py-3 px-4 text-right font-medium text-red-600">
                            {formatPaise(m.expensePaise)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-700">
                            {formatPaise(m.salesPaise)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatPaise(m.netProfitPaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Categories Breakdown */}
          {activeTab === 'categories' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">खर्च प्रकारनिहाय विभागणी (Expense Categories)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">बियाणे, खते, मजुरी, कीटकनाशके यांवरील खर्चाचे वर्गीकरण</p>
                </div>
              </div>

              {categories.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">कोणताही खर्च नोंदवलेला नाही.</div>
              ) : (
                <div className="p-5 space-y-4">
                  {categories.map((c) => {
                    const totalAll = categories.reduce((sum, item) => sum + item.totalAmountPaise, 0) || 1;
                    const percent = Math.round((c.totalAmountPaise / totalAll) * 100);
                    return (
                      <div key={c.categoryId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-bold text-slate-800">
                            {c.categoryNameMr} <span className="text-slate-400 font-normal">({c.count} नोंदी)</span>
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatPaise(c.totalAmountPaise)}{' '}
                            <span className="text-xs text-slate-500 font-medium">({percent}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-brand-green h-full rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
