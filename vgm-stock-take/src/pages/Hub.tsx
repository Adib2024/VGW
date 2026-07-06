import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Navigation } from '../components/Navigation';
import { Card } from '../components/ui/Card';
import { BackgroundDecor } from '../components/ui/BackgroundDecor';
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <Navigation title={t('hub')} showBack={false} />
      <BackgroundDecor />
      
      <style>{`
        .hub-main {
          flex: 1;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .hub-header {
          margin-bottom: 1.5rem;
          text-align: center;
          max-width: 600px;
          width: 100%;
        }
        .hub-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--primary-color);
          margin-bottom: 0.25rem;
          letter-spacing: -0.02em;
        }
        .hub-subtitle {
          font-size: 0.95rem;
          color: #64748b;
        }
        .hub-grid {
          width: 100%;
          max-width: 1000px;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .hub-card {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          text-align: left !important;
          padding: 1.25rem 1.5rem !important;
          background: linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%) !important;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.8);
          gap: 1.25rem;
        }
        .hub-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-card);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          flex-shrink: 0;
        }
        .hub-card-content {
          display: flex;
          flex-direction: column;
        }
        .hub-card-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.15rem;
        }
        .hub-card-desc {
          font-size: 0.85rem;
          color: #64748b;
          margin: 0;
          line-height: 1.3;
        }

        /* Desktop layout */
        @media (min-width: 768px) {
          .hub-main {
            padding: 2rem 1rem;
          }
          .hub-header {
            margin-bottom: 3rem;
          }
          .hub-title {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
          }
          .hub-subtitle {
            font-size: 1.1rem;
          }
          .hub-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
          }
          .hub-card {
            flex-direction: column !important;
            text-align: center !important;
            padding: 2.5rem 1.5rem !important;
            gap: 0;
          }
          .hub-icon-wrapper {
            width: 64px;
            height: 64px;
            border-radius: var(--radius-lg);
            margin-bottom: 1.5rem;
          }
          .hub-card-title {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
          }
          .hub-card-desc {
            font-size: 0.9rem;
            line-height: 1.5;
          }
        }
      `}</style>
      <main className="hub-main">
        <div className="hub-header">
          <h1 className="hub-title">
            {t('welcome')}, {user?.name}
          </h1>
          <p className="hub-subtitle">
            {t('selectModule')}
          </p>
        </div>
        
        <div className="hub-grid">
          <Card 
            interactive 
            onClick={() => navigate('/stock-take')}
            className="hub-card"
          >
            <div className="hub-icon-wrapper" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)' }}>
              <Package style={{ width: '50%', height: '50%' }} />
            </div>
            <div className="hub-card-content">
              <h2 className="hub-card-title">{t('stockTake')}</h2>
              <p className="hub-card-desc">{t('manageParts')}</p>
            </div>
          </Card>

          <Card 
            interactive 
            onClick={() => navigate('/battery')}
            className="hub-card"
          >
            <div className="hub-icon-wrapper" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}>
              <Battery style={{ width: '50%', height: '50%' }} />
            </div>
            <div className="hub-card-content">
              <h2 className="hub-card-title">{t('batteryTracking')}</h2>
              <p className="hub-card-desc">{t('trackBattery')}</p>
            </div>
          </Card>

          <Card 
            interactive 
            onClick={() => navigate('/qa')}
            className="hub-card"
          >
            <div className="hub-icon-wrapper" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.3)' }}>
              <ShieldCheck style={{ width: '50%', height: '50%' }} />
            </div>
            <div className="hub-card-content">
              <h2 className="hub-card-title">{t('qualityAssurance')}</h2>
              <p className="hub-card-desc">{t('performQA')}</p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
