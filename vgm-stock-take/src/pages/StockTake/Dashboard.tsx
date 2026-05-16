import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '../../components/Navigation';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { List, FileText, Settings } from 'lucide-react';

export default function StockTakeDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [progressData, setProgressData] = useState<Record<string, number>>({
    B17: 0,
    B22: 0,
    LOMA: 0,
    'B22 SEQ': 0,
    'CHECK PART': 0
  });

  useEffect(() => {
    // Fetch initial stats
    fetchStats();
    
    // Subscribe to realtime updates
    const tables = ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];
    const channels = tables.map(table => 
      supabase
        .channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, () => {
          fetchStats();
        })
        .subscribe()
    );

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);

  const fetchStats = async () => {
    try {
      const tables = ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];
      const promises = tables.map(table => supabase.from(table).select('status'));
      const results = await Promise.all(promises);
      
      const stats: Record<string, number> = {};
      
      results.forEach((res, index) => {
        const zoneName = tables[index].toUpperCase().replace('_', ' ');
        if (res.error || !res.data || res.data.length === 0) {
          stats[zoneName] = 0;
        } else {
          const score = res.data.reduce((acc, curr) => {
            if (curr.status === 'Verified') return acc + 1;
            if (curr.status === 'Counted') return acc + 0.5;
            return acc;
          }, 0);
          stats[zoneName] = (score / res.data.length) * 100;
        }
      });
      
      setProgressData(stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const getBackRoute = () => {
    if (user?.role === 'Counter B17' || user?.role === 'Counter B22') return '/';
    return '/hub';
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation title={t('stockTake')} backTo={getBackRoute()} />
      
      <main className="container flex-col gap-6" style={{ flex: 1, padding: '2rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>{t('zoneProgress')}</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Button onClick={() => navigate('/stock-take/list')}>
              <List size={18} /> List View
            </Button>
            <Button variant="secondary" onClick={() => navigate('/reports/progress')}>
              <FileText size={18} /> Reports
            </Button>
            {user?.role === 'Admin' && (
              <Button variant="secondary" onClick={() => navigate('/admin/settings')}>
                <Settings size={18} /> Admin
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(progressData).map(([zone, percentage]) => (
            <Card key={zone} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Zone {zone}</h3>
                <span style={{ 
                  backgroundColor: percentage === 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                  color: percentage === 100 ? 'var(--success-color)' : 'var(--primary-color)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}>
                  {percentage === 100 ? 'Completed' : 'In Progress'}
                </span>
              </div>
              
              <div style={{ marginTop: '1rem' }}>
                <ProgressBar percentage={percentage as number} showCar={true} />
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
