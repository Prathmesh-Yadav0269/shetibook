import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { syncService } from '../services/syncService';
import { WifiOff, RefreshCw, ShieldAlert } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { selectedGroup } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [quarantinedCount, setQuarantinedCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const checkPendingAndQuarantine = async () => {
    if (!selectedGroup) return;
    const count = await syncService.getPendingCount(selectedGroup.id);
    const qCount = await syncService.getQuarantinedCount(selectedGroup.id);
    setPendingCount(count);
    setQuarantinedCount(qCount);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming online
      handleManualSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkPendingAndQuarantine();
    const interval = setInterval(checkPendingAndQuarantine, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [selectedGroup?.id]);

  const handleManualSync = async () => {
    if (!selectedGroup || isSyncing || !navigator.onLine) return;
    try {
      setIsSyncing(true);
      setSyncStatusMsg('सिंक होत आहे...');
      const res = await syncService.syncGroupOperations(selectedGroup.id);
      await checkPendingAndQuarantine();
      if (res.processed > 0) {
        setSyncStatusMsg(`${res.processed} नोंदी यशस्वीरीत्या सिंक झाल्या!`);
        setTimeout(() => setSyncStatusMsg(null), 4000);
      } else {
        setSyncStatusMsg(null);
      }
    } catch (err: any) {
      await checkPendingAndQuarantine();
      setSyncStatusMsg(err?.message || 'सिंक करताना त्रुटी आली.');
      setTimeout(() => setSyncStatusMsg(null), 7000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Only render if offline OR has pending sync operations OR has quarantined records OR sync is in progress
  if (isOnline && pendingCount === 0 && quarantinedCount === 0 && !syncStatusMsg) {
    return null;
  }

  return (
    <div
      className={`w-full py-2 px-4 text-xs font-semibold flex items-center justify-between transition-colors ${
        !isOnline
          ? 'bg-amber-500 text-white'
          : quarantinedCount > 0
          ? 'bg-rose-700 text-white'
          : pendingCount > 0
          ? 'bg-blue-600 text-white'
          : 'bg-emerald-600 text-white'
      }`}
    >
      <div className="flex items-center gap-2 max-w-xl">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 flex-shrink-0 animate-bounce" />
            <span>
              तुम्ही ऑफलाइन आहात. सर्व नवीन नोंदी सुरक्षित स्थानिक मेमरीमध्ये साठवल्या जात आहेत.
            </span>
          </>
        ) : quarantinedCount > 0 ? (
          <>
            <ShieldAlert className="w-4 h-4 flex-shrink-0 animate-pulse text-amber-200" />
            <span>
              सावधान: गट अधिकार नसल्यामुळे {quarantinedCount} स्थानिक नोंदी क्वारंटाइन (सुरक्षित राखून) ठेवल्या आहेत. या नोंदी डिलीट न करता स्थानिक मेमरीत सुरक्षित आहेत, पण अधिकार असल्याशिवाय अपलोड होणार नाहीत.
            </span>
          </>
        ) : (
          <>
            <RefreshCw className={`w-4 h-4 flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {syncStatusMsg || `${pendingCount} ऑफलाइन नोंदी सिंक करणे बाकी आहेत.`}
            </span>
          </>
        )}
      </div>

      {isOnline && pendingCount > 0 && quarantinedCount === 0 && (
        <button
          type="button"
          disabled={isSyncing}
          onClick={handleManualSync}
          className="ml-3 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {isSyncing ? 'सिंक होत आहे...' : 'आता सिंक करा'}
        </button>
      )}
    </div>
  );
};
