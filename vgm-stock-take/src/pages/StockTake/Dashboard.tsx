import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Users, AlertTriangle, ChevronLeft, Settings } from 'lucide-react';

interface ZoneStats {
  total: number;
  completed: number;
  percentage: number;
}

export default function StockTakeDashboard() {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [stats, setStats] = useState<Record<string, ZoneStats>>({
    b17: { total: 0, completed: 0, percentage: 0 },
    b22: { total: 0, completed: 0, percentage: 0 },
    loma: { total: 0, completed: 0, percentage: 0 },
    b22_seq: { total: 0, completed: 0, percentage: 0 }
  });

  useEffect(() => {
    fetchStats();
    const tables = ['b17', 'b22', 'loma', 'b22_seq'];
    const channels = tables.map(table =>
      supabase.channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, fetchStats)
        .subscribe()
    );
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, []);

  const fetchStats = async () => {
    try {
      const tables = ['b17', 'b22', 'loma', 'b22_seq'];
      const promises = tables.map(table => supabase.from(table).select('status', { count: 'exact' }));
      const results = await Promise.all(promises);

      const newStats: Record<string, ZoneStats> = {};
      results.forEach((res, index) => {
        const table = tables[index];
        const data = res.data || [];
        const total = data.length;
        const completed = data.filter(r => r.status === 'Counted' || r.status === 'Verified').length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        newStats[table] = { total, completed, percentage };
      });
      setStats(newStats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCardClick = (tableKey: string) => {
    navigate(`/stock-take/list?table=${tableKey}`);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '1rem', fontFamily: 'Inter, sans-serif', paddingBottom: '3rem' }}>

      {/* HEADER SECTION */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>

        {/* Left Side: Title & User */}
        <div style={{ flex: '1 1 auto', minWidth: '150px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {(user?.role === 'Admin' || user?.role === 'Verifier') && (
            <button onClick={() => navigate('/hub')} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#333' }}>
              <ChevronLeft size={20} />
            </button>
          )}
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#001e50', margin: '0 0 0.25rem 0' }}>{t('selectData')}</h1>
            <div style={{ color: '#666', fontSize: '0.875rem' }}>{t('loggedInAs')}: {user?.name || user?.id}</div>
          </div>
        </div>

        {/* Center: Top Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: '1 1 auto', justifyContent: 'center', minWidth: '200px' }}>
          <button onClick={() => setShowLogoutConfirm(true)} style={{ padding: '0.25rem 1rem', borderRadius: '999px', border: '1px solid red', backgroundColor: 'transparent', color: 'red', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
            {t('logout')}
          </button>
          <button onClick={fetchStats} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #1877f2', backgroundColor: 'transparent', color: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
          <select value={language} onChange={(e) => setLanguage(e.target.value as any)} style={{ padding: '0.25rem 0.5rem', borderRadius: '999px', border: '1px solid #1877f2', backgroundColor: 'transparent', color: '#1877f2', fontSize: '0.75rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
            <option value="EN">English</option>
            <option value="BM">Bahasa Melayu</option>
            <option value="DE">Deutsch</option>
          </select>
        </div>

        {/* Right Side: Role & Live Data */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flex: '1 1 auto', minWidth: '100px' }}>
          <div style={{ color: '#1877f2', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
            {user?.role?.toUpperCase()} {t('view')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#2ecc71', fontSize: '0.75rem', fontWeight: 600 }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2ecc71', animation: 'pulse 2s infinite' }} />
            {t('liveData')}
          </div>
        </div>
      </div>

      {/* CARDS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', maxWidth: '800px', margin: '0 auto' }}>

        {/* Helper function to render a card */}
        {[
          { key: 'b17', title: 'LOCATION B17', delay: '0s', duration: '6s' },
          { key: 'b22', title: 'LOCATION B22', bg: '#ffebee', delay: '1.5s', duration: '6.5s' },
          { key: 'loma', title: 'LOMA', bg: '#e8f5e9', delay: '3.2s', duration: '5.5s' },
          { key: 'b22_seq', title: 'B22 SEQ', bg: '#fff8e1', delay: '4.8s', duration: '7s' }
        ].map((zone) => {
          const s = stats[zone.key];
          return (
            <Card key={zone.key} onClick={() => handleCardClick(zone.key)} className="dashboard-card" style={{ cursor: 'pointer', padding: '1.5rem', borderRadius: '16px', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', transition: 'transform 0.2s' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: zone.bg || '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg" alt="VW" style={{ width: '38px', height: '38px' }} />
                </div>
                <div>
                  <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: '#001e50', fontWeight: 700 }}>{zone.title}</h2>
                  <div style={{ color: '#666', fontSize: '0.875rem' }}>{s.completed} / {s.total} {t('items')}</div>
                </div>
              </div>

              <ProgressBar percentage={s.percentage} showCar={true} label={s.percentage === 100 ? t('ready') : t('pending')} carDelay={zone.delay} carDuration={zone.duration} />
            </Card>
          );
        })}
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px', margin: '2rem auto 0 auto' }}>
        <button onClick={() => navigate('/reports/progress')} style={{ width: '100%', padding: '1rem', borderRadius: '12px', backgroundColor: '#fff', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: '#1877f2', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>
          <Users size={20} /> {t('userProgress')}
        </button>

        <button onClick={() => navigate('/stock-take/list?table=check_part')} style={{ width: '100%', padding: '1rem', borderRadius: '12px', backgroundColor: '#fff', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: '#e74c3c', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>
          <AlertTriangle size={20} /> {t('viewCheckPart')}
        </button>

        {user?.role === 'Admin' && (
          <button onClick={() => navigate('/admin/settings')} style={{ width: '100%', padding: '1rem', borderRadius: '12px', backgroundColor: '#fff', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: '#8e44ad', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>
            <Settings size={20} /> {t('adminSettingsCsv')}
          </button>
        )}
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
    </div>
  );
}
