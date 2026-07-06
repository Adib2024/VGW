import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { BottomNav } from '../../components/ui/BottomNav';
import { Navigation } from '../../components/Navigation';
import { supabase, fetchAllRows } from '../../lib/supabase';
import { RefreshCw } from 'lucide-react';

interface ZoneStats {
  total: number;
  completed: number;
  percentage: number;
}

export default function StockTakeDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<Record<string, ZoneStats>>({
    b17: { total: 0, completed: 0, percentage: 0 },
    b22: { total: 0, completed: 0, percentage: 0 },
    loma: { total: 0, completed: 0, percentage: 0 },
    b22_seq: { total: 0, completed: 0, percentage: 0 }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    fetchStats();
    const tables = ['b17', 'b22', 'loma', 'b22_seq'];
    const channels = tables.map(table =>
      supabase.channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, () => {
          if (isMounted.current) fetchStats(false);
        })
        .subscribe()
    );
    return () => { 
      isMounted.current = false;
      channels.forEach(ch => supabase.removeChannel(ch)); 
    };
  }, []);

  const fetchStats = async (isManualRefresh: boolean = false) => {
    if (isManualRefresh && isMounted.current) setIsRefreshing(true);
    try {
      const tables = ['b17', 'b22', 'loma', 'b22_seq'];
      
      const promises = tables.map(table => fetchAllRows(table));
      const results = await Promise.all(promises);
      
      const newStats: Record<string, ZoneStats> = {};
      results.forEach((res, index) => {
        const table = tables[index];
        const data = res || [];

        const currentData = data;
        const total = currentData.length;
        const completed = currentData.filter((r: any) => r.status === 'Counted' || r.status === 'Verified').length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        newStats[table] = { total, completed, percentage };
      });
      
      if (isMounted.current) setStats(newStats);

      if (isManualRefresh) {
        addToast(t('dataRefreshed'), 'success');
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      if (isManualRefresh && isMounted.current) {
        // Add a small delay so the user can see the spin animation even if fetch is very fast
        setTimeout(() => {
          if (isMounted.current) setIsRefreshing(false);
        }, 500);
      }
    }
  };

  const handleCardClick = (tableKey: string) => {
    navigate(`/stock-take/list?table=${tableKey}`);
  };

  return (
    <>
      <style>{`
        .dash-main {
          min-height: 100vh;
          background: #f8fafc;
          padding: 0;
          font-family: 'Inter', sans-serif;
          padding-bottom: 5rem;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--success-color);
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .dash-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 0 1.25rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .dash-card {
          padding: 1.25rem !important;
          border-radius: 20px !important;
          background: #ffffff !important;
          border: 1px solid #f1f5f9 !important;
          box-shadow: 0 10px 30px -5px rgba(0,30,80,0.05), 0 4px 6px -2px rgba(0,30,80,0.025) !important;
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dash-card:active {
          transform: scale(0.98);
        }
        .dash-card-header {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          align-items: center;
        }
        .dash-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dash-card-icon img {
          width: 38px;
          height: 38px;
        }
        .dash-card-title {
          margin: 0 0 0.2rem 0;
          font-size: 1.05rem;
          color: #0f172a;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .dash-card-subtitle {
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 500;
        }

        @media (min-width: 768px) {
          .dash-main {
            padding-bottom: 2rem;
          }
          .dash-grid {
            grid-template-columns: repeat(2, 1fr);
            display: grid;
            gap: 1.5rem;
            max-width: 1000px;
            padding: 0 2rem;
          }
          .dash-card {
            padding: 1.75rem !important;
          }
        }
      `}</style>

      <div className="dash-main">
        <Navigation
          title="VGM CKD"
          titleAccessory={<div className="live-dot" title={t('liveData')} />}
          showBack={user?.role === 'Admin' || user?.role === 'Verifier'}
          backTo="/hub"
          extraMenuItems={(closeMenu) => (
            <button onClick={() => { fetchStats(true); closeMenu(); }} className="menu-item">
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> {t('refresh')}
            </button>
          )}
        />

        {/* CARDS GRID */}
        <div className="dash-grid">
          {[
            { key: 'b17', title: 'LOCATION B17', delay: '0s', duration: '15s', bg: '#e0f2fe' },
            { key: 'b22', title: 'LOCATION B22', delay: '1.5s', duration: '16.5s', bg: '#ffe4e6' },
            { key: 'loma', title: 'LOMA', delay: '3.2s', duration: '14.5s', bg: '#dcfce7' },
            { key: 'b22_seq', title: 'B22 SEQ', delay: '4.8s', duration: '17s', bg: '#fef3c7' }
          ].map((zone) => {
            const s = stats[zone.key];
            return (
              <Card key={zone.key} onClick={() => handleCardClick(zone.key)} className="dash-card" style={{ padding: undefined, borderRadius: undefined, backgroundColor: undefined, boxShadow: undefined, transition: undefined }}>
                <div className="dash-card-header">
                  <div className="dash-card-icon" style={{ backgroundColor: zone.bg || '#e3f2fd', background: zone.bg || '#e3f2fd' }}>
                    <img src="/vw-logo.svg" alt="VW" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 className="dash-card-title">{zone.title}</h2>
                    <div className="dash-card-subtitle">{s.completed} / {s.total} {t('items')}</div>
                  </div>
                </div>
                <ProgressBar percentage={s.percentage} showCar={true} label={s.percentage === 100 ? t('ready') : t('pending')} carDelay={zone.delay} carDuration={zone.duration} />
              </Card>
            );
          })}
        </div>

        <BottomNav />
      </div>
    </>
  );
}
