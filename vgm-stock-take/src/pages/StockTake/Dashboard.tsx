import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { BottomNav } from '../../components/ui/BottomNav';
import { supabase, fetchAllRows } from '../../lib/supabase';
import { RefreshCw, ChevronLeft, LogOut } from 'lucide-react';

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
  const [showMenu, setShowMenu] = useState(false);
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
      
      // OPTIMIZATION: Only fetch 'status, batch_id, metadata' instead of '*'
      const promises = tables.map(table => 
        supabase.from(table).select('status, batch_id, metadata')
      );
      
      const results = await Promise.all(promises);

      const newStats: Record<string, ZoneStats> = {};
      results.forEach((res, index) => {
        const table = tables[index];
        const data = res.data || [];

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
          background: #f8fafc;
          padding: 0;
          font-family: 'Inter', sans-serif;
          padding-bottom: 5rem;
        }
        .dash-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(0,0,0,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
        }
        .dash-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #001e50;
          margin: 0;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #2ecc71;
          box-shadow: 0 0 8px rgba(46, 204, 113, 0.6);
          animation: pulse 2s infinite;
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
        
        /* Dropdown Menu */
        .profile-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.5rem;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          border: 1px solid #f1f5f9;
          padding: 0.5rem;
          min-width: 200px;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          z-index: 60;
          animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .menu-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 10px;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          font-size: 0.85rem;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
        }
        .menu-item:hover {
          background: #f8fafc;
        }
        .menu-item.danger {
          color: #ef4444;
        }
        .menu-item.danger:hover {
          background: #fef2f2;
        }

        @media (min-width: 768px) {
          .dash-main {
            padding-bottom: 2rem;
          }
          .dash-header {
            padding: 1.5rem 2rem;
            margin-bottom: 2.5rem;
            border-bottom: 1px solid rgba(0,0,0,0.02);
            background: rgba(248, 250, 252, 0.9);
          }
          .dash-title {
            font-size: 1.5rem;
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
        {/* HEADER SECTION */}
        <div className="dash-header">
          {/* Left: Brand */}
          <div className="dash-title">
            {(user?.role === 'Admin' || user?.role === 'Verifier') && (
              <button onClick={() => navigate('/hub')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#001e50', marginRight: '0.25rem' }}>
                <ChevronLeft size={24} />
              </button>
            )}
            VGM CKD <div className="live-dot" title={t('liveData')} />
          </div>

          {/* Right: Profile Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              ({language})
            </span>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#001e50', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,30,80,0.2)' }}
            >
              {user?.name?.charAt(0).toUpperCase() || user?.id?.charAt(0).toUpperCase() || 'U'}
            </button>
            
            {showMenu && (
              <div className="profile-menu">
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{t('loggedInAs')}</div>
                  <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>{user?.name || user?.id}</div>
                  <div style={{ fontSize: '0.7rem', color: '#1877f2', fontWeight: 800, marginTop: '2px', textTransform: 'uppercase' }}>{user?.role}</div>
                </div>
                
                <button onClick={() => { fetchStats(true); setShowMenu(false); }} className="menu-item">
                  <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> {t('refresh')}
                </button>
                
                <div style={{ padding: '0 0.75rem', margin: '0.5rem 0' }}>
                  <select value={language} onChange={(e) => { setLanguage(e.target.value as any); setShowMenu(false); }} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
                    <option value="EN">English</option>
                    <option value="BM">Bahasa Melayu</option>
                    <option value="DE">Deutsch</option>
                  </select>
                </div>
                
                <button onClick={() => { setShowMenu(false); setShowLogoutConfirm(true); }} className="menu-item danger">
                  <LogOut size={16} /> {t('logout')}
                </button>
              </div>
            )}
          </div>
        </div>

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
