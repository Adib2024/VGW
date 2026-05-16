import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Navigation } from '../components/Navigation';
import { Card } from '../components/ui/Card';
import { Package, Battery, ShieldCheck } from 'lucide-react';

export default function Hub() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Push an initial state so the first back click gets intercepted
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // Force history to stay here and refresh the page instead of going back
      window.history.pushState(null, '', window.location.href);
      window.location.reload();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation title={t('hub')} showBack={false} />
      
      <main className="container flex-col gap-6" style={{ flex: 1, padding: '2rem 1rem' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1>Welcome, {user?.name}</h1>
          <p>Select a module to continue</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            interactive 
            onClick={() => navigate('/stock-take')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 2rem' }}
          >
            <div style={{ 
              width: '80px', height: '80px', 
              borderRadius: '50%', 
              backgroundColor: 'rgba(59, 130, 246, 0.2)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.5rem',
              color: 'var(--primary-color)'
            }}>
              <Package size={40} />
            </div>
            <h2>{t('stockTake')}</h2>
            <p>Manage parts inventory, counts, and verification across zones.</p>
          </Card>

          <Card 
            interactive 
            onClick={() => navigate('/battery')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 2rem' }}
          >
            <div style={{ 
              width: '80px', height: '80px', 
              borderRadius: '50%', 
              backgroundColor: 'rgba(16, 185, 129, 0.2)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.5rem',
              color: 'var(--success-color)'
            }}>
              <Battery size={40} />
            </div>
            <h2>{t('batteryTracking')}</h2>
            <p>Track battery statuses, locations, and lifecycle.</p>
          </Card>

          <Card 
            interactive 
            onClick={() => navigate('/qa')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 2rem' }}
          >
            <div style={{ 
              width: '80px', height: '80px', 
              borderRadius: '50%', 
              backgroundColor: 'rgba(245, 158, 11, 0.2)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.5rem',
              color: 'var(--warning-color)'
            }}>
              <ShieldCheck size={40} />
            </div>
            <h2>{t('qualityAssurance')}</h2>
            <p>Perform QA inspections and log discrepancies.</p>
          </Card>

        </div>
      </main>
    </div>
  );
}
