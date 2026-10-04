import { useState, useEffect, useRef, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { errorMessage } from '../../lib/errors';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { BottomNav } from '../../components/ui/BottomNav';
import { Navigation } from '../../components/Navigation';
import { CarTrack } from '../../components/ui/CarTrack';
import { fetchRowsIfTableExists } from '../../lib/supabase';
import { useRealtimeTables } from '../../hooks/useRealtimeTables';
import { ZONE_ORDER, ZONE_THEME } from '../../lib/zoneTheme';
import { RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';

const ZONE_TABLES = ZONE_ORDER;

interface ZoneStats {
  total: number;
  completed: number;
  counted: number;
  percentage: number;
  missing?: boolean;
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
      // A zone whose table doesn't exist yet resolves to null instead of
      // failing the whole dashboard.
      const promises = ZONE_TABLES.map(table => fetchRowsIfTableExists(table));
      const results = await Promise.all(promises);

      const newStats: Record<string, ZoneStats> = {};
      results.forEach((res, index) => {
        const table = ZONE_TABLES[index];
        const data = res || [];
        const total = data.length;
        const completed = data.filter((r) => r.status === 'Verified').length;
        const counted = data.filter((r) => r.status === 'Counted').length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        newStats[table] = { total, completed, counted, percentage, missing: res === null };
      });

      if (isMounted.current) setStats(newStats);

      // check_part may not exist until an admin uploads it - treat as none flagged.
      fetchRowsIfTableExists('check_part')
        .then(rows => { if (isMounted.current) setCheckOpen((rows || []).filter((r) => r.status !== 'Verified').length); })
        .catch(() => { if (isMounted.current) setCheckOpen(0); });

      if (isManualRefresh) {
        addToast(t('dataRefreshed'), 'success');
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      // Otherwise a real fetch failure looks identical to "genuinely 0
      // progress" - the numbers on screen would just silently be wrong.
      addToast(errorMessage(err) || 'Failed to load progress data.', 'error');
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
        .dash-main {
          flex: 1; display: flex; flex-direction: column;
          padding-bottom: calc(var(--bottom-nav-h) + 0.75rem + env(safe-area-inset-bottom));
        }
        .dash-hero {
          background: var(--primary-color);
          color: #fff;
          border-radius: var(--radius-panel);
          padding: 0.875rem 1rem 1rem;
          margin-top: 0.25rem;
        }
        .dash-hero-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-top: 0.25rem; }
        .dash-hero-fig { font-size: 3rem; font-weight: 700; line-height: 0.9; letter-spacing: -0.04em; }
        .dash-split { display: flex; flex-direction: column; gap: 0.1875rem; }
        .dash-split > div { display: flex; align-items: center; gap: 0.4375rem; font-size: 0.6875rem; color: var(--text-on-dark); }
        .dash-split i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dash-split b { margin-left: auto; padding-left: 0.75rem; font-family: var(--font-mono); font-size: 0.8125rem; color: #fff; }
        .dash-main .ds-section-label { margin: 0.875rem 0.25rem 0.5rem; }
        .dash-grid { flex: 1; display: grid; gap: 0.5rem; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; }
        @media (min-width: 900px) { .dash-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .zone-tile { position: relative; overflow: hidden; padding: 0.75rem 0.75rem 0.5rem; display: flex !important; flex-direction: column; justify-content: space-between; gap: 0.25rem; }
        .zone-tile::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 5px; background: var(--zc); }
        .zone-code { font-size: 1.75rem; font-weight: 900; font-stretch: 70%; line-height: 1; color: var(--zc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .zone-pct { font-size: 1.25rem; font-weight: 700; line-height: 1; }
        .zone-tile .ds-chip { height: 20px; padding: 0 0.5rem; font-size: 0.5625rem; }
        @media (max-height: 680px) {
          .dash-hero-fig { font-size: 2.5rem; }
          .dash-main .ds-section-label { margin: 0.5rem 0.25rem 0.375rem; }
          .zone-count { display: none; }
        }
        .dash-check { display: flex !important; align-items: center; gap: 0.75rem; padding: 0.625rem 0.875rem; margin-top: 0.5rem; background: var(--signal-soft); box-shadow: inset 0 0 0 1.5px var(--signal-line); }
      `}</style>

      <div className="screen-fit">
      <div className="screen-col">
        <Navigation
          title={t('stockTake')}
          titleAccessory={<span className="ds-chip live" title={t('liveData')}>{t('live')}</span>}
          showBack={user?.role === 'Admin' || user?.role === 'Verifier'}
          backTo="/hub"
          extraMenuItems={(closeMenu) => (
            <button onClick={() => { fetchStats(true); closeMenu(); }} className="menu-item">
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> {t('refresh')}
            </button>
          )}
        />

        <main className="ds-page dash-main">
          <section className="dash-hero">
            <div className="eyebrow" style={{ color: 'var(--text-on-dark)' }}>{t('overallProgress')} · {t('verified')}</div>
            <div className="dash-hero-top">
              <div>
                <div className="dash-hero-fig mono">
                  {aggregate.percentage}<span style={{ fontSize: '0.5em', color: 'var(--signal-color)' }}>%</span>
                </div>
                <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-on-dark)', marginTop: '0.375rem' }}>
                  {aggregate.completed.toLocaleString()} / {aggregate.total.toLocaleString()}
                </div>
              </div>
              <div className="dash-split">
                <div><i style={{ border: '1.5px solid var(--text-on-dark)' }} />{t('notCounted')}<b>{aggregate.notCounted.toLocaleString()}</b></div>
                <div><i style={{ background: '#FFD15C' }} />{t('counted')}<b>{aggregate.counted.toLocaleString()}</b></div>
                <div><i style={{ background: '#3DDC97' }} />{t('verified')}<b>{aggregate.completed.toLocaleString()}</b></div>
              </div>
            </div>
            <div className="ds-seg dark" style={{ height: 10, marginTop: '0.75rem' }}>
              <span style={{ '--c': 'var(--signal-color)', width: `${aggregate.percentage}%` } as CSSProperties} />
            </div>
          </section>

          <div className="ds-section-label">
            <span className="eyebrow">{t('zones')}</span>
            <span className="hint">{t('tapZoneHint')}</span>
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
                  style={{ '--zc': zone.accent } as CSSProperties}
                  onClick={() => navigate(`/stock-take/list?table=${zone.key}`)}
                  aria-label={`${zone.title}: ${s.percentage}% verified`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
                    <div className="vw-badge" aria-hidden="true" style={{ width: 20, height: 20, background: zone.accentSoft }}>
                      <img src="/vw-logo.svg" alt="" />
                    </div>
                    <div className="zone-code">{zone.code}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.375rem' }}>
                    <div className="zone-pct mono">{s.percentage}<span style={{ fontSize: '0.6em', color: 'var(--text-secondary)' }}>%</span></div>
                    {s.missing
                      ? <span className="ds-chip st-nc">{t('noData')}</span>
                      : <span className={`ds-chip ${done ? 'done' : ''}`}>{done ? t('ready') : t('pending')}</span>}
                  </div>
                  <div>
                    <CarTrack percentage={s.percentage} color={zone.accent} carDelay={zone.carDelay} carDuration={zone.carDuration} carWidth={48} height={6} />
                    <div className="mono zone-count" style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {s.completed.toLocaleString()} / {s.total.toLocaleString()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button type="button" className="ds-card dash-check" onClick={() => navigate('/stock-take/list?table=check_part')}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--signal-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={18} strokeWidth={2.2} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 800 }}>{t('checkPart')}</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--warning-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span className="mono" style={{ fontWeight: 700 }}>{checkOpen ?? '—'}</span> {t('partsFlagged')}
              </span>
            </span>
            <ChevronRight size={20} />
          </button>
        </main>

        <BottomNav />
      </div>
      </div>
    </>
  );
}
