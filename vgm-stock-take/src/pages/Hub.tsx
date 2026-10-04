import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Navigation } from '../components/Navigation';
import { fetchRowsIfTableExists, supabase } from '../lib/supabase';
import { ZONE_ORDER } from '../lib/zoneTheme';
import { Package, Battery, ShieldCheck, ChevronRight, Users, Upload, LineChart } from 'lucide-react';

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
    accent: '#2D5BFF', accentSoft: '#E5ECFF',
    icon: <Package size={26} />, roles: ['Admin', 'Verifier'],
  },
  {
    key: 'battery', path: '/battery', titleKey: 'batteryTracking', descKey: 'trackBattery',
    accent: '#0B7A55', accentSoft: '#DDF3EA',
    icon: <Battery size={26} />, roles: ['Admin', 'Operator Batt'],
  },
  {
    key: 'qa', path: '/qa', titleKey: 'qualityAssurance', descKey: 'performQA',
    accent: '#A15C00', accentSoft: '#FFF0D1',
    icon: <ShieldCheck size={26} />, roles: ['Admin', 'QA Inspector'],
  },
];

export default function Hub() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stock, setStock] = useState<{ completed: number; total: number } | null>(null);
  const [checkOpen, setCheckOpen] = useState<number | null>(null);
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
      Promise.all(ZONE_ORDER.map(t => fetchRowsIfTableExists(t)))
        .then(results => {
          if (cancelled) return;
          const rows = results.flatMap(r => r || []);
          setStock({ total: rows.length, completed: rows.filter((r: any) => r.status === 'Verified').length });
        })
        .catch(err => console.error('Hub: failed to load Stock Take progress:', err));

      // check_part may not exist yet (no upload) - that's simply "nothing flagged".
      fetchRowsIfTableExists('check_part')
        .then(rows => { if (!cancelled) setCheckOpen((rows || []).filter((r: any) => r.status !== 'Verified').length); })
        .catch(() => { if (!cancelled) setCheckOpen(0); });
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
  const canSee = (key: ModuleDef['key']) => visibleModules.some(m => m.key === key);
  const stockPct = stock ? (stock.total === 0 ? 0 : Math.round((stock.completed / stock.total) * 100)) : null;

  const readouts = [
    canSee('stockTake') && { k: t('partsVerified'), v: stockPct === null ? '—' : String(stockPct), unit: '%' },
    canSee('battery') && { k: t('trackedToday'), v: batteryToday === null ? '—' : String(batteryToday), unit: '' },
    canSee('stockTake') && { k: t('partsToCheck'), v: checkOpen === null ? '—' : String(checkOpen), unit: '' },
  ].filter(Boolean) as { k: string; v: string; unit: string }[];

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' });

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <style>{`
        .hub-hero { background: var(--primary-color); color: #fff; padding: 0 0 64px; }
        .hub-hero-inner { max-width: 1080px; margin: 0 auto; padding: 0.5rem 1.25rem 0; }
        .hub-hero h2 { margin: 0.5rem 0 0; color: #fff; font-size: clamp(1.75rem, 6vw, 2.25rem); }
        .hub-readouts { display: grid; margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.14); padding-top: 1rem; max-width: 560px; }
        .hub-readouts > div + div { border-left: 1px solid rgba(255,255,255,0.14); padding-left: 0.875rem; }
        .hub-readouts .v { font-size: 1.625rem; font-weight: 700; }
        .hub-readouts .k { font-size: 0.75rem; color: var(--text-on-dark); margin-top: 0.125rem; }
        .hub-modules { display: grid; gap: 0.75rem; grid-template-columns: 1fr; margin-top: -40px; }
        @media (min-width: 760px) { .hub-modules { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); } }
        .hub-mod { padding: 1.125rem; animation: ds-rise 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .hub-mod:nth-child(2) { animation-delay: 0.06s; }
        .hub-mod:nth-child(3) { animation-delay: 0.12s; }
        .hub-mod-head { display: flex; align-items: center; gap: 0.875rem; }
        .hub-mod-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .hub-mod h3 { margin: 0; font-size: 1.125rem; }
        .hub-mod p { margin: 0.125rem 0 0; font-size: 0.8125rem; }
        .hub-tools { display: grid; gap: 0.625rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .hub-tool { display: flex !important; flex-direction: column; align-items: flex-start; gap: 0.625rem; padding: 0.875rem; min-height: 92px; font-size: 0.8125rem; font-weight: 700; }
        @media (prefers-reduced-motion: reduce) { .hub-mod { animation: none; } }
      `}</style>

      <Navigation title="VGM CKD" variant="dark" brand />

      <div className="hub-hero">
        <div className="hub-hero-inner">
          <div className="eyebrow" style={{ color: 'var(--text-on-dark)' }}>{today}</div>
          <h2>{t('welcome')}, {user?.name}</h2>
          <div style={{ marginTop: '0.625rem' }}>
            <span className="ds-chip" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>{user?.role}</span>
          </div>
          {readouts.length > 0 && (
            <div className="hub-readouts" style={{ gridTemplateColumns: `repeat(${readouts.length}, minmax(0, 1fr))` }}>
              {readouts.map(r => (
                <div key={r.k}>
                  <div className="v mono">{r.v}{r.v !== '—' && r.unit && <span style={{ color: 'var(--signal-color)' }}>{r.unit}</span>}</div>
                  <div className="k">{r.k}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="ds-page" style={{ flex: 1 }}>
        <div className="hub-modules">
          {visibleModules.map((m) => (
            <button
              key={m.key}
              type="button"
              className="ds-card hub-mod"
              onClick={() => navigate(m.path)}
            >
              <div className="hub-mod-head">
                <div className="hub-mod-icon" style={{ background: m.accentSoft, color: m.accent }}>{m.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3>{t(m.titleKey)}</h3>
                  <p>{t(m.descKey)}</p>
                </div>
                {m.key === 'qa'
                  ? <span className="ds-chip">{t('soon')}</span>
                  : <ChevronRight size={22} color="var(--text-secondary)" />}
              </div>

              {m.key === 'stockTake' && (
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="ds-seg" style={{ flex: 1 }}><span style={{ ['--c' as any]: m.accent, width: `${stockPct ?? 0}%` }} /></div>
                  <div className="mono" style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                    {stock ? `${stock.completed.toLocaleString()} / ${stock.total.toLocaleString()}` : '—'}
                  </div>
                </div>
              )}

              {m.key === 'battery' && (
                <div style={{ marginTop: '0.875rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="ds-chip live">{batteryToday === null ? '—' : batteryToday} {t('trackedToday').toLowerCase()}</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {user?.role === 'Admin' && (
          <>
            <div className="ds-section-label"><span className="eyebrow">{t('adminTools')}</span></div>
            <div className="hub-tools">
              <button type="button" className="ds-card hub-tool" onClick={() => navigate('/admin/users')}>
                <Users size={22} /> {t('users')}
              </button>
              <button type="button" className="ds-card hub-tool" onClick={() => navigate('/admin/settings')}>
                <Upload size={22} /> {t('uploadParts')}
              </button>
              <button type="button" className="ds-card hub-tool" onClick={() => navigate('/reports/progress')}>
                <LineChart size={22} /> {t('progress')}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
