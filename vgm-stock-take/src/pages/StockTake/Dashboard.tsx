import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { BottomNav } from '../../components/ui/BottomNav';
import { Navigation } from '../../components/Navigation';
import { BackgroundDecor } from '../../components/ui/BackgroundDecor';
import { fetchAllRows } from '../../lib/supabase';
import { useRealtimeTables } from '../../hooks/useRealtimeTables';
import { ZONE_ORDER, ZONE_THEME } from '../../lib/zoneTheme';
import { RefreshCw } from 'lucide-react';

const ZONE_TABLES = ZONE_ORDER;

interface ZoneStats {
  total: number;
  completed: number;
  percentage: number;
}

const ZONES = ZONE_ORDER.map(key => ZONE_THEME[key]);

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
    return () => { isMounted.current = false; };
  }, []);

  useRealtimeTables(ZONE_TABLES, () => fetchStats(false));

  const fetchStats = async (isManualRefresh: boolean = false) => {
    if (isManualRefresh && isMounted.current) setIsRefreshing(true);
    try {
      const promises = ZONE_TABLES.map(table => fetchAllRows(table));
      const results = await Promise.all(promises);

      const newStats: Record<string, ZoneStats> = {};
      results.forEach((res, index) => {
        const table = ZONE_TABLES[index];
        const data = res || [];

        const currentData = data;
        const total = currentData.length;
        const completed = currentData.filter((r: any) => r.status === 'Verified').length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        newStats[table] = { total, completed, percentage };
      });

      if (isMounted.current) setStats(newStats);

      if (isManualRefresh) {
        addToast(t('dataRefreshed'), 'success');
      }
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      // Otherwise a real fetch failure looks identical to "genuinely 0
      // progress" - the numbers on screen would just silently be wrong.
      addToast(err?.message || 'Failed to load progress data.', 'error');
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

  const aggregate = useMemo(() => {
    const total = ZONE_TABLES.reduce((sum, key) => sum + stats[key].total, 0);
    const completed = ZONE_TABLES.reduce((sum, key) => sum + stats[key].completed, 0);
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percentage };
  }, [stats]);

  return (
    <>
      <style>{`
        .dash-main {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', sans-serif;
          padding-bottom: 5rem;
        }

        .dash-hero {
          position: relative;
          margin-top: -1.5rem;
          background:
            radial-gradient(900px 420px at 12% -20%, rgba(255,255,255,0.08) 0%, transparent 60%),
            linear-gradient(155deg, var(--primary-color) 0%, #001330 100%);
          color: #fff;
          overflow: hidden;
        }
        @media (min-width: 768px) {
          .dash-hero { margin-top: -2.5rem; }
        }
        .dash-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 42px 42px;
          -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,0.9) 0%, transparent 92%);
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.9) 0%, transparent 92%);
        }
        .dash-hero-body {
          position: relative;
          z-index: 1;
          max-width: 1080px;
          margin: 0 auto;
          padding: clamp(1.75rem, 5vw, 2.25rem) 1.5rem clamp(1.75rem, 5vw, 2rem);
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2rem;
          flex-wrap: wrap;
        }
        .dash-hero-eyebrow {
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em;
          color: rgba(255,255,255,0.5); margin-bottom: 0.6rem;
        }
        .dash-hero-figure {
          font-size: clamp(2.4rem, 7vw, 3.4rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .dash-hero-figure sup { font-size: 0.42em; font-weight: 700; margin-left: 0.15rem; color: rgba(255,255,255,0.55); }
        .dash-hero-sub {
          margin-top: 0.6rem; color: rgba(255,255,255,0.62); font-size: 0.92rem; font-weight: 500;
          font-variant-numeric: tabular-nums;
        }
        .dash-hero-zones { display: flex; gap: 1.4rem; text-align: right; flex-wrap: wrap; justify-content: flex-end; }
        .dash-hz .k { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: rgba(255,255,255,0.45); }
        .dash-hz .v { font-size: 1.02rem; font-weight: 700; margin-top: 0.3rem; font-variant-numeric: tabular-nums; }
        .dash-hz .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 0.4rem; vertical-align: middle; }

        .dash-content {
          position: relative;
          flex: 1;
          max-width: 1080px;
          width: 100%;
          margin: 0 auto;
          padding: clamp(1.75rem, 5vw, 2.25rem) 1.5rem clamp(2.5rem, 7vw, 4rem);
        }
        .dash-section-label {
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
          color: var(--text-secondary); margin: 0 0 1.1rem; padding-left: 0.15rem;
        }

        .dash-grid {
          display: grid;
          gap: 1.25rem;
          grid-template-columns: 1fr;
        }
        @media (min-width: 720px) {
          .dash-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .zone-tile {
          position: relative;
          background: var(--surface-color, #fff);
          border-radius: var(--radius-panel);
          padding: 1.6rem 1.6rem 1.5rem;
          box-shadow: 0 10px 30px -8px rgba(var(--primary-color-rgb), 0.14), 0 2px 8px -2px rgba(var(--primary-color-rgb), 0.06);
          cursor: pointer;
          border: none;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          text-align: left;
          width: 100%;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .zone-tile:hover, .zone-tile:focus-visible {
          transform: translateY(-3px);
          box-shadow: 0 22px 44px -10px rgba(var(--primary-color-rgb), 0.22), 0 4px 12px -2px rgba(var(--primary-color-rgb), 0.08);
        }
        .zone-tile:active { transform: translateY(-1px) scale(0.99); }
        .zone-tile::before, .zone-tile::after {
          content: ''; position: absolute; width: 14px; height: 14px; opacity: 0.5;
        }
        .zone-tile::before { top: 10px; left: 10px; border-top: 2px solid var(--zc); border-left: 2px solid var(--zc); border-radius: 3px 0 0 0; }
        .zone-tile::after { bottom: 10px; right: 10px; border-bottom: 2px solid var(--zc); border-right: 2px solid var(--zc); border-radius: 0 0 3px 0; }

        .zone-head { display: flex; gap: 1rem; align-items: center; }
        .zone-icon {
          width: 50px; height: 50px; border-radius: var(--radius-card);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          background: var(--zc-soft); box-shadow: inset 0 0 0 1.5px var(--zc);
        }
        .zone-icon img { width: 30px; height: 30px; }
        .zone-title { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; color: var(--primary-color); margin: 0; }
        .zone-sub { margin-top: 0.2rem; color: var(--text-secondary); font-size: 0.82rem; font-weight: 500; font-variant-numeric: tabular-nums; }
        .zone-status {
          margin-left: auto; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
          padding: 0.3rem 0.6rem; border-radius: var(--radius-full); white-space: nowrap; flex-shrink: 0;
        }
        .zone-status.ready { background: var(--success-bg); color: var(--success-text); }
        .zone-status.pending { background: var(--surface-highlight); color: var(--text-secondary); }

        .zone-progress { display: flex; flex-direction: column; gap: 0.5rem; margin-top: auto; }
        .zone-progress-row { display: flex; justify-content: space-between; align-items: baseline; }
        .zone-progress-row .zone-progress-label { font-size: 0.68rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .zone-progress-row .pct { font-size: 0.95rem; font-weight: 700; color: var(--primary-color); font-variant-numeric: tabular-nums; }
        .zone-bar-track { position: relative; height: 50px; overflow: hidden; }
        .zone-bar-base { position: absolute; bottom: 4px; width: 100%; height: 7px; border-radius: var(--radius-full); background: rgba(var(--primary-color-rgb), 0.08); overflow: hidden; }
        .zone-bar-fill { height: 100%; border-radius: var(--radius-full); background: var(--zc); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }

        @media (prefers-reduced-motion: reduce) {
          .zone-tile, .zone-bar-fill { transition: none !important; }
        }
      `}</style>

      <div className="dash-main">
        <BackgroundDecor />
        <Navigation
          title="VGM CKD"
          titleAccessory={<div className="live-dot" title={t('liveData')} style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--success-color)', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />}
          showBack={user?.role === 'Admin' || user?.role === 'Verifier'}
          backTo="/hub"
          extraMenuItems={(closeMenu) => (
            <button onClick={() => { fetchStats(true); closeMenu(); }} className="menu-item">
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> {t('refresh')}
            </button>
          )}
        />

        <div className="dash-hero">
          <div className="dash-hero-body">
            <div>
              <div className="dash-hero-eyebrow">{t('stockTake')} &middot; {t('overallProgress')}</div>
              <div className="dash-hero-figure">{aggregate.percentage}<sup>%</sup></div>
              <div className="dash-hero-sub">{aggregate.completed.toLocaleString()} / {aggregate.total.toLocaleString()} {t('items')}</div>
            </div>
            <div className="dash-hero-zones">
              {ZONES.map(z => (
                <div className="dash-hz" key={z.key}>
                  <div className="k">{z.heroLabel}</div>
                  <div className="v"><span className="dot" style={{ backgroundColor: z.heroDot }} />{stats[z.key].percentage}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dash-content">
          <p className="dash-section-label">{t('zones')}</p>
          <div className="dash-grid">
            {ZONES.map((zone) => {
              const s = stats[zone.key];
              return (
                <button
                  key={zone.key}
                  type="button"
                  className="zone-tile"
                  style={{ ['--zc' as any]: zone.accent, ['--zc-soft' as any]: zone.accentSoft }}
                  onClick={() => handleCardClick(zone.key)}
                >
                  <div className="zone-head">
                    <div className="zone-icon">
                      <img src="/vw-logo.svg" alt="VW" />
                    </div>
                    <div>
                      <h2 className="zone-title">{zone.title}</h2>
                      <div className="zone-sub">{s.completed} / {s.total} {t('items')}</div>
                    </div>
                    <span className={`zone-status ${s.percentage === 100 ? 'ready' : 'pending'}`}>
                      {s.percentage === 100 ? t('ready') : t('pending')}
                    </span>
                  </div>
                  <div className="zone-progress">
                    <div className="zone-progress-row">
                      <span className="zone-progress-label">{t('progress')}</span>
                      <span className="pct">{s.percentage}%</span>
                    </div>
                    <div className="zone-bar-track">
                      <div className="zone-bar-base"><div className="zone-bar-fill" style={{ width: `${s.percentage}%` }} /></div>
                      <div className="car-icon-anim" style={{ bottom: '8px', animationDelay: zone.carDelay, animationDuration: zone.carDuration }}>
                        <img src="/car-golf.webp" alt="car" decoding="async" style={{ width: '80px', height: 'auto', objectFit: 'contain' }} />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <BottomNav />
      </div>
    </>
  );
}
