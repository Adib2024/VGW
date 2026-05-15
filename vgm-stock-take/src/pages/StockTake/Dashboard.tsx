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
  
  const [progressData, setProgressData] = useState({
    B17: 0,
    B22: 0,
    LOMA: 0,
    'B22 SEQ': 0
  });

  useEffect(() => {
    // Fetch initial stats
    fetchStats();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('parts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.from('parts').select('zone, status');
      if (error) throw error;
      
      const zones = ['B17', 'B22', 'LOMA', 'B22 SEQ'];
      const stats: any = {};
      
      zones.forEach(z => {
        const zoneParts = data.filter(p => p.zone === z);
        if (zoneParts.length === 0) {
          stats[z] = 0;
        } else {
          // Status weight: Counted = 50%, Verified = 100%
          const score = zoneParts.reduce((acc, curr) => {
            if (curr.status === 'Verified') return acc + 1;
            if (curr.status === 'Counted') return acc + 0.5;
            return acc;
          }, 0);
          stats[z] = (score / zoneParts.length) * 100;
        }
      });
      
      setProgressData(stats as any);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const getBackRoute = () => {
    if (user?.role === 'Counter') return '/';
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
