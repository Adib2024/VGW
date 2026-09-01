import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Navigation } from '../components/Navigation';
import { BackgroundDecor } from '../components/ui/BackgroundDecor';
import { fetchAllRows, supabase } from '../lib/supabase';
import { Package, Battery, ShieldCheck } from 'lucide-react';

const ZONE_TABLES = ['b17', 'b22', 'loma', 'b22_seq'];

// Malaysia has no DST, so a fixed UTC+8 offset is enough to get "today" right
// for the battery count below, matching the timezone already used for
// display formatting elsewhere in the app (Reports/UserProgress.tsx).
function startOfTodayMalaysiaISO(): string {
  const nowMY = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const startMY = Date.UTC(nowMY.getUTCFullYear(), nowMY.getUTCMonth(), nowMY.getUTCDate());
  return new Date(startMY - 8 * 60 * 60 * 1000).toISOString();
}

interface ModuleDef {
  key: 'stockTake' | 'battery' | 'qa';
  path: string;
  titleKey: string;
  descKey: string;
  accent: string;
  accentSoft: string;
  icon: React.ReactNode;
  roles: string[];
}

const MODULES: ModuleDef[] = [
  {
    key: 'stockTake', path: '/stock-take', titleKey: 'stockTake', descKey: 'manageParts',
    accent: '#2563eb', accentSoft: 'rgba(37,99,235,0.1)',
    icon: <Package size={24} />, roles: ['Admin', 'Verifier'],
  },
  {
    key: 'battery', path: '/battery', titleKey: 'batteryTracking', descKey: 'trackBattery',
    accent: '#059669', accentSoft: 'rgba(5,150,105,0.1)',
    icon: <Battery size={24} />, roles: ['Admin', 'Operator Batt'],
  },
  {
    key: 'qa', path: '/qa', titleKey: 'qualityAssurance', descKey: 'performQA',
    accent: '#d97706', accentSoft: 'rgba(217,119,6,0.1)',
    icon: <ShieldCheck size={24} />, roles: ['Admin', 'QA Inspector'],
  },
];

export default function Hub() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stockTakePercent, setStockTakePercent] = useState<number | null>(null);
  const [batteryToday, setBatteryToday] = useState<number | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    // Only fetch data for modules actually visible to this role - no point
    // querying zone tables for an Operator Batt who'll never see that card.
    const visibleKeys = new Set(MODULES.filter(m => user?.role && m.roles.includes(user.role)).map(m => m.key));

    if (visibleKeys.has('stockTake')) {
      Promise.all(ZONE_TABLES.map(t => fetchAllRows(t)))
        .then(results => {
          if (cancelled) return;
          const rows = results.flat();
          const total = rows.length;
          const completed = rows.filter((r: any) => r.status === 'Verified').length;
          setStockTakePercent(total === 0 ? 0 : Math.round((completed / total) * 100));
        })
        .catch(err => console.error('Hub: failed to load Stock Take progress:', err));
    }

    if (visibleKeys.has('battery')) {
      supabase
        .from('battery_tracking')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfTodayMalaysiaISO())
        .then(({ count, error }) => {
          if (cancelled) return;
          if (error) { console.error('Hub: failed to load battery count:', error); return; }
          setBatteryToday(count ?? 0);
        });
    }

    return () => { cancelled = true; };
  }, [user?.role]);

  const visibleModules = MODULES.filter(m => user?.role && m.roles.includes(user.role));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <style>{`
        .hub-hero {
          position: relative;
          /* Cancels Navigation's own margin-bottom (1.5rem mobile / 2.5rem
             desktop) so the hero sits flush under the nav bar instead of
             leaving a visible gap of background showing through. */
          margin-top: -1.5rem;
          background:
            radial-gradient(900px 420px at 12% -20%, rgba(255,255,255,0.08) 0%, transparent 60%),
            linear-gradient(155deg, var(--primary-color) 0%, #001330 100%);
          color: #fff;
          overflow: hidden;
        }
        @media (min-width: 768px) {
          .hub-hero { margin-top: -2.5rem; }
        }
        .hub-hero::before {
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
        .hub-hero::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; width: 260px; left: -260px;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%);
          animation: hub-sweep 9s linear infinite;
        }
        @keyframes hub-sweep { to { left: 110%; } }

        .hub-hero-body {
          position: relative;
          z-index: 1;
          max-width: 1080px;
          margin: 0 auto;
          padding: clamp(1.75rem, 5vw, 2.75rem) 1.5rem clamp(1.75rem, 5vw, 2.5rem);
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2rem;
          flex-wrap: wrap;
        }
        .hub-title {
          font-size: clamp(1.9rem, 5vw, 2.65rem); font-weight: 700; letter-spacing: -0.03em;
          line-height: 1.05; margin: 0; text-wrap: balance; color: #fff;
        }
        .hub-subtitle { margin: 0.6rem 0 0; color: rgba(255,255,255,0.62); font-size: 0.98rem; font-weight: 500; }

        .hub-readout { text-align: right; padding-bottom: 0.15rem; }
        .hub-readout .k {
          font-size: 0.63rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
          color: rgba(255,255,255,0.45);
        }
        .hub-readout .v {
          font-size: 1.05rem; font-weight: 700; margin-top: 0.25rem; color: #fff;
          font-variant-numeric: tabular-nums; letter-spacing: 0.01em;
        }

        .hub-main {
          position: relative;
          flex: 1;
          max-width: 1080px;
          width: 100%;
          margin: 0 auto;
          padding: clamp(1.75rem, 5vw, 2.5rem) 1.5rem clamp(2.5rem, 7vw, 4rem);
        }
        .hub-section-label {
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
          color: var(--text-secondary); margin: 0 0 1.1rem; padding-left: 0.15rem;
        }
        .hub-grid {
          display: grid;
          gap: 1.25rem;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }
        .hub-grid[data-count="1"] { grid-template-columns: minmax(260px, 420px); justify-content: center; }
        .hub-grid[data-count="2"] { grid-template-columns: repeat(2, minmax(260px, 1fr)); max-width: 700px; margin: 0 auto; }

        .hub-tile {
          position: relative;
          background: var(--surface-color, #fff);
          border-radius: var(--radius-panel);
          padding: 1.75rem 1.6rem 1.5rem;
          box-shadow: 0 10px 30px -8px rgba(var(--primary-color-rgb), 0.14), 0 2px 8px -2px rgba(var(--primary-color-rgb), 0.06);
          cursor: pointer;
          border: none;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          text-align: left;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          animation: hub-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          width: 100%;
        }
        .hub-tile:nth-child(1) { animation-delay: 0.03s; }
        .hub-tile:nth-child(2) { animation-delay: 0.1s; }
        .hub-tile:nth-child(3) { animation-delay: 0.17s; }
        @keyframes hub-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .hub-tile:hover, .hub-tile:focus-visible {
          transform: translateY(-5px);
          box-shadow: 0 22px 44px -10px rgba(var(--primary-color-rgb), 0.22), 0 4px 12px -2px rgba(var(--primary-color-rgb), 0.08);
        }
        .hub-tile:active { transform: translateY(-1px) scale(0.99); }

        .hub-tile::before, .hub-tile::after {
          content: ''; position: absolute; width: 14px; height: 14px; opacity: 0; transition: opacity 0.25s ease;
        }
        .hub-tile::before { top: 10px; left: 10px; border-top: 2px solid var(--tile-accent); border-left: 2px solid var(--tile-accent); border-radius: 3px 0 0 0; }
        .hub-tile::after { bottom: 10px; right: 10px; border-bottom: 2px solid var(--tile-accent); border-right: 2px solid var(--tile-accent); border-radius: 0 0 3px 0; }
        .hub-tile:hover::before, .hub-tile:hover::after, .hub-tile:focus-visible::before, .hub-tile:focus-visible::after { opacity: 0.5; }

        .hub-tile-icon {
          width: 50px; height: 50px; border-radius: var(--radius-card);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          background: var(--tile-accent-soft);
          box-shadow: inset 0 0 0 1.5px var(--tile-accent);
          color: var(--tile-accent);
        }
        .hub-tile h2 { font-size: 1.15rem; font-weight: 700; margin: 0; letter-spacing: -0.01em; color: var(--primary-color); }
        .hub-tile p.hub-tile-desc { margin: 0.35rem 0 0; color: var(--text-secondary); font-size: 0.85rem; font-weight: 500; line-height: 1.5; }

        .hub-tile-stat { padding-top: 1.05rem; margin-top: auto; border-top: 1px dashed rgba(var(--primary-color-rgb), 0.1); }
        .hub-tile-stat-row { display: flex; align-items: baseline; justify-content: space-between; }
        .hub-tile-stat .stat-label { font-size: 0.68rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .hub-tile-stat .stat-value { font-size: 0.95rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--primary-color); }
        .hub-bar-track { height: 5px; border-radius: var(--radius-full); background: rgba(var(--primary-color-rgb), 0.08); overflow: hidden; margin-top: 0.6rem; }
        .hub-bar-fill { height: 100%; border-radius: var(--radius-full); background: var(--tile-accent); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }

        @media (prefers-reduced-motion: reduce) {
          .hub-tile, .hub-hero::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      <Navigation title={t('hub')} showBack={false} />

      <div className="hub-hero">
        <div className="hub-hero-body">
          <div>
            <h1 className="hub-title">{t('welcome')}, {user?.name}</h1>
            <p className="hub-subtitle">{t('selectModule')}</p>
          </div>
          <div className="hub-readout">
            <div className="k">{t('today')}</div>
            <div className="v">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
          </div>
        </div>
      </div>

      <BackgroundDecor />

      <main className="hub-main">
        <p className="hub-section-label">{t('yourModules')}</p>
        <div className="hub-grid" data-count={visibleModules.length}>
          {visibleModules.map((m) => {
            const stat = m.key === 'stockTake'
              ? { label: t('overallProgress'), value: stockTakePercent === null ? '—' : `${stockTakePercent}%`, percent: stockTakePercent }
              : m.key === 'battery'
                ? { label: t('trackedToday'), value: batteryToday === null ? '—' : String(batteryToday), percent: null }
                : null;

            return (
              <button
                key={m.key}
                type="button"
                className="hub-tile"
                style={{ ['--tile-accent' as any]: m.accent, ['--tile-accent-soft' as any]: m.accentSoft }}
                onClick={() => navigate(m.path)}
                aria-label={t(m.titleKey)}
              >
                <div className="hub-tile-icon">{m.icon}</div>
                <div>
                  <h2>{t(m.titleKey)}</h2>
                  <p className="hub-tile-desc">{t(m.descKey)}</p>
                </div>
                {stat && (
                  <div className="hub-tile-stat">
                    <div className="hub-tile-stat-row">
                      <span className="stat-label">{stat.label}</span>
                      <span className="stat-value">{stat.value}</span>
                    </div>
                    {stat.percent !== null && (
                      <div className="hub-bar-track">
                        <div className="hub-bar-fill" style={{ width: `${stat.percent ?? 0}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
