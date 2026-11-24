import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { financeApi } from '../services/financeApi';
import { agricultureApi } from '../../agriculture/services/agricultureApi';
import { Harvest } from '../types';
import { Farm } from '../../agriculture/types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { formatQuantity } from '../../../utils/finance';
import {
  Wheat,
  Plus,
  Filter,
  ChevronRight,
} from 'lucide-react';

export const HarvestListPage: React.FC = () => {
  const { selectedGroup } = useAuth();
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'mr') as 'mr' | 'en';

  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHarvests = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const [hRes, farmRes] = await Promise.all([
        financeApi.getHarvests(selectedGroup.id, {
          farmId: selectedFarmId || undefined,
        }),
        agricultureApi.getFarms(selectedGroup.id),
      ]);
      setHarvests(hRes || []);
      setFarms(farmRes || []);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'काढणी नोंदी लोड करता आल्या नाहीत');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup, selectedFarmId]);

  useEffect(() => {
    fetchHarvests();
  }, [fetchHarvests]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wheat className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {lang === 'mr' ? 'काढणी व उत्पादन नोंदवही' : 'Harvest & Production Records'}
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {lang === 'mr'
              ? 'शेतातून निघालेले धान्य/उत्पादन, शिल्लक साठा आणि विक्रीचा ताळमेळ'
              : 'Track harvested yields, remaining inventory and sales'}
          </p>
        </div>

        <Link to="/harvests/new">
          <Button className="w-full sm:w-auto bg-brand-green hover:bg-brand-green-hover shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {lang === 'mr' ? 'नवीन काढणी नोंदवा' : 'Record Harvest'}
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Filter Bar */}
      <div className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-slate-200">
        <Filter className="w-4 h-4 text-slate-400 ml-1" />
        <select
          value={selectedFarmId}
          onChange={(e) => setSelectedFarmId(e.target.value)}
          className="text-sm bg-transparent border-none text-slate-700 focus:outline-none focus:ring-0 font-medium"
        >
          <option value="">{lang === 'mr' ? 'सर्व शेते (All Farms)' : 'All Farms'}</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.farmName} ({f.village})
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-2">{lang === 'mr' ? 'काढणी लोड होत आहे...' : 'Loading harvests...'}</p>
        </div>
      ) : harvests.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <Wheat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            {lang === 'mr' ? 'कोणतीही काढणी नोंदवलेली नाही' : 'No harvests recorded yet'}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {lang === 'mr'
              ? 'पिकांची काढणी झाल्यावर एकूण उत्पादन नोंदवून ठेवा जेणेकरून विक्री अचूक करता येईल.'
              : 'Record harvested crop yields to accurately track sold vs available produce inventory.'}
          </p>
          <Link to="/harvests/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {lang === 'mr' ? 'पहिली काढणी नोंदवा' : 'Record First Harvest'}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {harvests.map((h) => {
            const soldPercent = Math.min(100, Math.round((h.soldQuantity / h.quantity) * 100));
            return (
              <Link key={h.id} to={`/harvests/${h.id}`}>
                <Card className="hover:border-slate-300 transition-all p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-base">{h.cropName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {h.plotName}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{h.farmName}</span>
                      <span>•</span>
                      <span>{h.harvestDate}</span>
                      {h.notes && (
                        <>
                          <span>•</span>
                          <span className="italic truncate max-w-xs">&quot;{h.notes}&quot;</span>
                        </>
                      )}
                    </div>

                    {/* Inventory progress bar */}
                    <div className="pt-1 max-w-xs">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                        <span>
                          {lang === 'mr' ? 'विक्री:' : 'Sold:'} {formatQuantity(h.soldQuantity, h.unit, lang)}
                        </span>
                        <span className="font-bold text-emerald-700">
                          {lang === 'mr' ? 'शिल्लक:' : 'Left:'} {formatQuantity(h.remainingQuantity, h.unit, lang)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all"
                          style={{ width: `${soldPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end sm:space-x-4 text-right border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div>
                      <span className="text-xs text-slate-500 block">
                        {lang === 'mr' ? 'एकूण उत्पादन' : 'Total Harvest'}
                      </span>
                      <span className="text-lg font-bold text-slate-900 block">
                        {formatQuantity(h.quantity, h.unit, lang)}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-green group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
