import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { supabase, fetchAllRows } from '../../lib/supabase';
import { RefreshCw, Users, AlertTriangle, ChevronLeft, Settings } from 'lucide-react';

interface ZoneStats {
  total: number;
  completed: number;
  percentage: number;
}

export default function StockTakeDashboard() {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [stats, setStats] = useState<Record<string, ZoneStats>>({
    b17: { total: 0, completed: 0, percentage: 0 },
    b22: { total: 0, completed: 0, percentage: 0 },
    loma: { total: 0, completed: 0, percentage: 0 },
    b22_seq: { total: 0, completed: 0, percentage: 0 }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
    const tables = ['b17', 'b22', 'loma', 'b22_seq'];
    const channels = tables.map(table =>
      supabase.channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, () => fetchStats(false))
        .subscribe()
    );
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, []);

  const fetchStats = async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const tables = ['b17', 'b22', 'loma', 'b22_seq'];
      const promises = tables.map(table => fetchAllRows(table));
      const results = await Promise.all(promises);

      const newStats: Record<string, ZoneStats> = {};
      results.forEach((res, index) => {
        const table = tables[index];
        const data = res || [];
        
        // Find latest batch_id
        const batches = [...new Set(data.map((r: any) => r.batch_id || r.metadata?.batch_id).filter(Boolean))].sort().reverse();
        const latestBatch = batches[0];
        
        // Filter by latest batch if it exists, otherwise use all (for legacy data)
        const currentData = latestBatch 
          ? data.filter((r: any) => (r.batch_id === latestBatch || r.metadata?.batch_id === latestBatch))
          : data;

        const total = currentData.length;
        const completed = currentData.filter((r: any) => r.status === 'Counted' || r.status === 'Verified').length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        newStats[table] = { total, completed, percentage };
      });
      setStats(newStats);
      
      if (isManualRefresh) {
        addToast(t('dataRefreshed'), 'success');
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      if (isManualRefresh) {
        // Add a small delay so the user can see the spin animation even if fetch is very fast
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleCardClick = (tableKey: string) => {
    navigate(`/stock-take/list?table=${tableKey}`);
  };

  return (
    <>
      <style>{`
        .dash-main {
          min-height: 100vh;
          background-color: #f0f2f5;
          padding: 0.75rem;
          font-family: 'Inter', sans-serif;
          padding-bottom: 2rem;
        }
        .dash-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          gap: 0.5rem;
        }
        .dash-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #001e50;
          margin: 0 0 0.15rem 0;
        }
        .dash-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .dash-card {
          padding: 1rem !important;
          border-radius: 12px !important;
          background-color: #fff !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.03) !important;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .dash-card:hover {
          transform: translateY(-2px);
        }
        .dash-card-header {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          align-items: center;
        }
        .dash-card-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dash-card-icon img {
          width: 28px;
          height: 28px;
        }
        .dash-card-title {
          margin: 0 0 0.15rem 0;
          font-size: 1.05rem;
          color: #001e50;
          font-weight: 700;
        }
        .dash-card-subtitle {
          color: #666;
          font-size: 0.8rem;
        }
        .dash-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-width: 800px;
          margin: 1rem auto 0 auto;
        }
        .dash-btn {
          width: 100%;
          padding: 0.85rem;
          border-radius: 10px;
          background-color: #fff;
          border: none;
          box-shadow: 0 4px 10px rgba(0,0,0,0.03);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .dash-btn:active {
          transform: scale(0.98);
        }
        
        @media (min-width: 768px) {
          .dash-main {
            padding: 1.5rem;
            padding-bottom: 3rem;
          }
          .dash-header {
            margin-bottom: 2rem;
            gap: 1rem;
          }
          .dash-title {
            font-size: 1.75rem;
          }
          .dash-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.25rem;
          }
          .dash-card {
            padding: 1.5rem !important;
            border-radius: 16px !important;
          }
          .dash-card-header {
            gap: 1rem;
            margin-bottom: 1.5rem;
          }
          .dash-card-icon {
            width: 48px;
            height: 48px;
          }
          .dash-card-icon img {
            width: 38px;
            height: 38px;
          }
          .dash-card-title {
            font-size: 1.15rem;
            margin-bottom: 0.25rem;
          }
          .dash-card-subtitle {
            font-size: 0.875rem;
          }
          .dash-actions {
            gap: 1rem;
            margin-top: 2rem;
          }
          .dash-btn {
            padding: 1rem;
            border-radius: 12px;
            font-size: 1rem;
          }
        }
      `}</style>

      <div className="dash-main">
        {/* HEADER SECTION */}
        <div className="dash-header">
          {/* Left Side: Title & User */}
          <div style={{ flex: '1 1 auto', minWidth: '150px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {(user?.role === 'Admin' || user?.role === 'Verifier') && (
              <button onClick={() => navigate('/hub')} style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#333' }}>
                <ChevronLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="dash-title">{t('selectData')}</h1>
              <div style={{ color: '#666', fontSize: '0.8rem' }}>{t('loggedInAs')}: {user?.name || user?.id}</div>
            </div>
          </div>

          {/* Center: Top Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: '1 1 auto', justifyContent: 'center', minWidth: '180px' }}>
            <button onClick={() => setShowLogoutConfirm(true)} style={{ padding: '0.2rem 0.75rem', borderRadius: '999px', border: '1px solid red', backgroundColor: 'transparent', color: 'red', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
              {t('logout')}
            </button>
            <button onClick={() => fetchStats(true)} disabled={isRefreshing} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #1877f2', backgroundColor: 'transparent', color: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isRefreshing ? 'default' : 'pointer', opacity: isRefreshing ? 0.7 : 1 }}>
              <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            <select value={language} onChange={(e) => setLanguage(e.target.value as any)} style={{ padding: '0.2rem 0.5rem', borderRadius: '999px', border: '1px solid #1877f2', backgroundColor: 'transparent', color: '#1877f2', fontSize: '0.7rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
              <option value="EN">English</option>
              <option value="BM">Bahasa Melayu</option>
              <option value="DE">Deutsch</option>
            </select>
          </div>

          {/* Right Side: Role & Live Data */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', flex: '1 1 auto', minWidth: '100px' }}>
            <div style={{ color: '#1877f2', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>
              {user?.role?.toUpperCase()} {t('view')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#2ecc71', fontSize: '0.7rem', fontWeight: 600 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2ecc71', animation: 'pulse 2s infinite' }} />
              {t('liveData')}
            </div>
          </div>
        </div>

        {/* CARDS GRID */}
        <div className="dash-grid">
          {[
            { key: 'b17', title: 'LOCATION B17', delay: '0s', duration: '6s' },
            { key: 'b22', title: 'LOCATION B22', bg: '#ffebee', delay: '1.5s', duration: '6.5s' },
            { key: 'loma', title: 'LOMA', bg: '#e8f5e9', delay: '3.2s', duration: '5.5s' },
            { key: 'b22_seq', title: 'B22 SEQ', bg: '#fff8e1', delay: '4.8s', duration: '7s' }
          ].map((zone) => {
            const s = stats[zone.key];
            return (
              <Card key={zone.key} onClick={() => handleCardClick(zone.key)} className="dash-card" style={{ padding: undefined, borderRadius: undefined, backgroundColor: undefined, boxShadow: undefined, transition: undefined }}>
                <div className="dash-card-header">
                  <div className="dash-card-icon" style={{ backgroundColor: zone.bg || '#e3f2fd' }}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg" alt="VW" />
                  </div>
                  <div>
                    <h2 className="dash-card-title">{zone.title}</h2>
                    <div className="dash-card-subtitle">{s.completed} / {s.total} {t('items')}</div>
                  </div>
                </div>
                <ProgressBar percentage={s.percentage} showCar={true} label={s.percentage === 100 ? t('ready') : t('pending')} carDelay={zone.delay} carDuration={zone.duration} />
              </Card>
            );
          })}
        </div>

        {/* ACTION BUTTONS */}
        <div className="dash-actions">
          <button onClick={() => navigate('/reports/progress')} className="dash-btn" style={{ color: '#1877f2' }}>
            <Users size={18} /> {t('userProgress')}
          </button>

          <button onClick={() => navigate('/stock-take/list?table=check_part')} className="dash-btn" style={{ color: '#e74c3c' }}>
            <AlertTriangle size={18} /> {t('viewCheckPart')}
          </button>

          {user?.role === 'Admin' && (
            <button onClick={() => navigate('/admin/settings')} className="dash-btn" style={{ color: '#8e44ad' }}>
              <Settings size={18} /> {t('adminSettingsCsv')}
            </button>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '16px', maxWidth: '320px', width: '90%', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#001e50' }}>{t('logout')}</h3>
            <p style={{ margin: '0 0 2rem 0', color: '#666' }}>{t('confirmLogout')}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>{t('cancel')}</button>
              <button onClick={handleLogout} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', background: 'red', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{t('logout')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
