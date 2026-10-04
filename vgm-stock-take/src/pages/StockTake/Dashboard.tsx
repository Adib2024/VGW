import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { BottomNav } from '../../components/ui/BottomNav';
import { Navigation } from '../../components/Navigation';
import { CarTrack } from '../../components/ui/CarTrack';
import { fetchAllRows } from '../../lib/supabase';
import { useRealtimeTables } from '../../hooks/useRealtimeTables';
import { ZONE_ORDER, ZONE_THEME } from '../../lib/zoneTheme';
import { RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';

const ZONE_TABLES = ZONE_ORDER;

interface ZoneStats {
  total: number;
  completed: number;
  counted: number;
  percentage: number;
}

const EMPTY_STATS: ZoneStats = { total: 0, completed: 0, counted: 0, percentage: 0 };
const ZONES = ZONE_ORDER.map(key => ZONE_THEME[key]);

export default function StockTakeDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<Record<string, ZoneStats>>(
    Object.fromEntries(ZONE_TABLES.map(k => [k, EMPTY_STATS]))
  );
  const [checkOpen, setCheckOpen] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    fetchStats();
    return () => { isMounted.current = false; };
  }, []);

  useRealtimeTables([...ZONE_TABLES, 'check_part'], () => fetchStats(false));

  const fetchStats = async (isManualRefresh: boolean = false) => {
    if (isManualRefresh && isMounted.current) setIsRefreshing(true);
    try {
      const promises = ZONE_TABLES.map(table => fetchAllRows(table));
      const results = await Promise.all(promises);

      const newStats: Record<string, ZoneStats> = {};
      results.forEach((res, index) => {
        const table = ZONE_TABLES[index];
        const data = res || [];
        const total = data.length;
        const completed = data.filter((r: any) => r.status === 'Verified').length;
        const counted = data.filter((r: any) => r.status === 'Counted').length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        newStats[table] = { total, completed, counted, percentage };
      });

      if (isMounted.current) setStats(newStats);

      // check_part may not exist until an admin uploads it - treat as none flagged.
      fetchAllRows('check_part')
        .then(rows => { if (isMounted.current) setCheckOpen((rows || []).filter((r: any) => r.status !== 'Verified').length); })
        .catch(() => { if (isMounted.current) setCheckOpen(0); });

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

  const aggregate = useMemo(() => {
    const total = ZONE_TABLES.reduce((sum, key) => sum + stats[key].total, 0);
    const completed = ZONE_TABLES.reduce((sum, key) => sum + stats[key].completed, 0);
    const counted = ZONE_TABLES.reduce((sum, key) => sum + stats[key].counted, 0);
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, counted, notCounted: total - completed - counted, percentage };
  }, [stats]);

  return (
    <>
      <style>{`
        .dash-hero {
          background: var(--primary-color);
          color: #fff;
          border-radius: var(--radius-panel);
          padding: 1.375rem 1.25rem 1.25rem;
          margin-top: 0.25rem;
        }
        .dash-hero-fig { font-size: clamp(4rem, 18vw, 5rem); font-weight: 700; line-height: 0.95; letter-spacing: -0.04em; }
        .dash-split { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin-top: 1.125rem; }
        .dash-split > div { background: rgba(255,255,255,0.06); border-radius: var(--radius-md); padding: 0.625rem 0.75rem; }
        .dash-split .k { display: flex; align-items: center; gap: 0.375rem; font-size: 0.6875rem; font-weight: 600; color: var(--text-on-dark); }
        .dash-split .k i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dash-split .v { font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem; }
        .dash-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (min-width: 900px) { .dash-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .zone-tile { position: relative; overflow: hidden; padding: 1rem 1rem 0.75rem; display: flex !important; flex-direction: column; gap: 0.5rem; }
        .zone-tile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 6px; background: var(--zc); }
        .zone-code { font-size: 2.5rem; font-weight: 900; font-stretch: 70%; line-height: 1; color: var(--zc); white-space: nowrap; margin-top: 0.125rem; }
        .zone-pct { font-size: 1.625rem; font-weight: 700; line-height: 1; }
        .dash-check { display: flex !important; align-items: center; gap: 0.875rem; padding: 1rem; margin-top: 0.875rem; background: var(--signal-soft); box-shadow: inset 0 0 0 1.5px var(--signal-line); }
      `}</style>

      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <Navigation
          title={t('stockTake')}
          titleAccessory={<span className="ds-chip live" title={t('liveData')}>Live</span>}
          showBack={user?.role === 'Admin' || user?.role === 'Verifier'}
          backTo="/hub"
          extraMenuItems={(closeMenu) => (
            <button onClick={() => { fetchStats(true); closeMenu(); }} className="menu-item">
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> {t('refresh')}
            </button>
          )}
        />

        <main className="ds-page with-nav" style={{ flex: 1 }}>
          <section className="dash-hero">
            <div className="eyebrow" style={{ color: 'var(--text-on-dark)' }}>{t('overallProgress')} · {t('verified')}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginTop: '0.375rem' }}>
              <div className="dash-hero-fig mono">
                {aggregate.percentage}<span style={{ fontSize: '0.45em', color: 'var(--signal-color)' }}>%</span>
              </div>
              <div style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>
                <div className="mono" style={{ fontSize: '1.0625rem', fontWeight: 700 }}>{aggregate.completed.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-on-dark)' }}>/ {aggregate.total.toLocaleString()} {t('items').toLowerCase()}</div>
              </div>
            </div>
            <div className="ds-seg dark" style={{ height: 14, marginTop: '1rem' }}>
              <span style={{ ['--c' as any]: 'var(--signal-color)', width: `${aggregate.percentage}%` }} />
            </div>
            <div className="dash-split">
              <div>
                <div className="k"><i style={{ border: '1.5px solid var(--text-on-dark)' }} />{t('notCounted')}</div>
                <div className="v mono">{aggregate.notCounted.toLocaleString()}</div>
              </div>
              <div>
                <div className="k"><i style={{ background: '#FFD15C' }} />{t('counted')}</div>
                <div className="v mono">{aggregate.counted.toLocaleString()}</div>
              </div>
              <div>
                <div className="k"><i style={{ background: '#3DDC97' }} />{t('verified')}</div>
                <div className="v mono">{aggregate.completed.toLocaleString()}</div>
              </div>
            </div>
          </section>

          <div className="ds-section-label">
            <span className="eyebrow">{t('zones')}</span>
            <span className="hint">Tap a zone to start counting</span>
          </div>

          <div className="dash-grid">
            {ZONES.map((zone) => {
              const s = stats[zone.key];
              const done = s.total > 0 && s.percentage === 100;
              return (
                <button
                  key={zone.key}
                  type="button"
                  className="ds-card zone-tile"
                  style={{ ['--zc' as any]: zone.accent }}
                  onClick={() => navigate(`/stock-take/list?table=${zone.key}`)}
                  aria-label={`${zone.title}: ${s.percentage}% verified`}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="vw-badge" aria-hidden="true" style={{ width: 20, height: 20, background: zone.accentSoft }}>
                        <img src="/vw-logo.svg" alt="" />
                      </div>
                      <span className="eyebrow" style={{ fontSize: '0.625rem' }}>{zone.kind}</span>
                    </div>
                    <div className="zone-code">{zone.code}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.375rem' }}>
                    <div className="zone-pct mono">{s.percentage}<span style={{ fontSize: '0.6em', color: 'var(--text-secondary)' }}>%</span></div>
                    <span className={`ds-chip ${done ? 'done' : ''}`}>{done ? t('ready') : t('pending')}</span>
                  </div>
                  <CarTrack percentage={s.percentage} color={zone.accent} carDelay={zone.carDelay} carDuration={zone.carDuration} carWidth={64} height={8} />
                  <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {s.completed.toLocaleString()} / {s.total.toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>

          <button type="button" className="ds-card dash-check" onClick={() => navigate('/stock-take/list?table=check_part')}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--signal-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={22} strokeWidth={2.2} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '1rem', fontWeight: 800 }}>Check Part</span>
              <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--warning-text)', marginTop: 2 }}>
                <span className="mono" style={{ fontWeight: 700 }}>{checkOpen ?? '—'}</span> parts flagged for a second look
              </span>
            </span>
            <ChevronRight size={22} />
          </button>
        </main>

        <BottomNav />
      </div>
    </>
  );
}
