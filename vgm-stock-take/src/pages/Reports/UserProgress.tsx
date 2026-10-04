import { useState, useEffect, useRef } from 'react';
import { Navigation } from '../../components/Navigation';
import { supabase, fetchAllRows } from '../../lib/supabase';
import { Download, PackageSearch } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { BottomNav } from '../../components/ui/BottomNav';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { getStatusChipClass } from '../../lib/statusColor';
import { ZONE_THEME } from '../../lib/zoneTheme';


export default function UserProgress() {
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const isMounted = useRef(true);
  const { user } = useAuth();
  const { t } = useLanguage();
  const [lastLogin, setLastLogin] = useState('-');
  const [loginDevice, setLoginDevice] = useState('-');
  const [lastLogout, setLastLogout] = useState('-');
  const [logoutDevice, setLogoutDevice] = useState('-');

  useEffect(() => {
    if (user) {
      supabase.from('audit_logs')
        .select('created_at, device_type')
        .eq('user_id', user.id)
        .eq('action', 'LOGIN')
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setLastLogin(new Date(data[0].created_at).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' }));
            setLoginDevice(data[0].device_type || '-');
          }
        });

      supabase.from('audit_logs')
        .select('created_at, device_type')
        .eq('user_id', user.id)
        .in('action', ['MANUAL_LOGOUT', 'AUTO_LOGOUT'])
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setLastLogout(new Date(data[0].created_at).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' }));
            setLogoutDevice(data[0].device_type || '-');
          }
        });
    }
  }, [user]);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => { isMounted.current = false; };
  }, []);

  const fetchData = async () => {
    try {
      const tables = ['b17', 'b22', 'b22_seq', 'loma', 'check_part'];
      let allParts: any[] = [];

      for (const t of tables) {
        const tableData = await fetchAllRows(t);
        if (tableData && tableData.length > 0) {
          allParts = [...allParts, ...tableData.map(d => ({ ...d, _table: t }))];
        }
      }

      // Sort by status instead since last_updated does not exist
      if (isMounted.current) {
        setParts(allParts.sort((a, b) => {
          const order = { 'Verified': 1, 'Counted': 2, 'Not Counted': 3 };
          return (order[a.status as keyof typeof order] || 4) - (order[b.status as keyof typeof order] || 4);
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Material,Location/Zone,Status,Verified By,Batch ID'];
    const rows = filteredParts.map(p => {
      const loc = `${p.location || p.rack_number || p.storage_bin || ''} (${p._table})`;
      return `${p.material || p.part_no || ''},${loc},${p.status || ''},${p.verify_by || ''},${p.batch_id || ''}`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "VGM_StockTake_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueLocations = Array.from(new Set(parts.map(p => p._table?.toUpperCase()))).filter(Boolean);

  const filteredParts = parts.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    const locStr = p._table?.toUpperCase();
    if (locationFilter !== 'all' && locStr !== locationFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredParts.length / PAGE_SIZE));
  const paginatedParts = filteredParts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, locationFilter]);

  const notCountedCount = parts.filter(p => p.status === 'Not Counted').length;
  const countedCount = parts.filter(p => p.status === 'Counted').length;
  const verifiedCount = parts.filter(p => p.status === 'Verified').length;
  const share = (n: number) => (parts.length ? (n / parts.length) * 100 : 0);
  const verifiedPercentage = Math.round(share(verifiedCount));
  const statusLabel = (s: string) => s === 'Verified' ? t('verified') : s === 'Counted' ? t('counted') : t('notCounted');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .up-stack { display: flex; height: 18px; border-radius: 6px; overflow: hidden; gap: 3px; background: var(--surface-highlight); }
        .up-stack > div { transition: width 0.5s ease; }
        .up-split { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 1rem; }
        .up-split > div + div { border-left: 1px solid var(--bg-color); padding-left: 0.75rem; }
        .up-split .k { display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); }
        .up-split .k i { width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0; }
        .up-split .v { font-size: 1.375rem; font-weight: 700; margin-top: 0.25rem; }
        .up-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.625rem; margin-top: 1rem; }
        @media (min-width: 760px) { .up-filters { grid-template-columns: 1fr 1fr auto; align-items: end; } }
        .up-list { list-style: none; margin: 0; padding: 0.25rem 1rem; }
        .up-list li { display: grid; grid-template-columns: 6px minmax(0, 1fr); gap: 0.875rem; padding: 0.875rem 0; border-bottom: 1px solid var(--bg-color); }
        .up-list li:last-child { border-bottom: 0; }
        .up-list .bar { border-radius: 3px; }
      `}</style>

      <Navigation title={t('userProgressReport') || 'User Progress Report'} backTo="/stock-take" />

      <main className="ds-page with-nav" style={{ flex: 1 }}>
        <div style={{ padding: '0.25rem 0.25rem 0' }}>
          <div className="eyebrow">{user?.name || '-'} · {user?.role || '-'}</div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
            <span className="ds-chip" style={{ background: '#fff', boxShadow: 'inset 0 0 0 1.5px var(--border-color)', color: 'var(--text-primary)', textTransform: 'none', letterSpacing: 0 }}>
              {t('lastLogin') || 'Last Login'}: <span className="mono">{lastLogin}</span>{loginDevice !== '-' && ` · ${loginDevice}`}
            </span>
            <span className="ds-chip" style={{ background: '#fff', boxShadow: 'inset 0 0 0 1.5px var(--border-color)', textTransform: 'none', letterSpacing: 0 }}>
              {t('lastLogout') || 'Last Logout'}: <span className="mono">{lastLogout}</span>{logoutDevice !== '-' && ` · ${logoutDevice}`}
            </span>
          </div>
        </div>

        <section className="ds-card" style={{ padding: '1.125rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: '0.875rem' }}>
            <div className="mono" style={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 1 }}>
              {verifiedPercentage}<span style={{ fontSize: '0.55em', color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{verifiedCount.toLocaleString()}</span> / {parts.length.toLocaleString()} {t('verified').toLowerCase()}
            </div>
          </div>
          <div className="up-stack" role="img" aria-label={`${t('notCounted')} ${notCountedCount}, ${t('counted')} ${countedCount}, ${t('verified')} ${verifiedCount}`}>
            <div style={{ width: `${share(notCountedCount)}%`, background: '#C9C5B9' }} />
            <div style={{ width: `${share(countedCount)}%`, background: 'var(--warning-color)' }} />
            <div style={{ width: `${share(verifiedCount)}%`, background: 'var(--success-color)' }} />
          </div>
          <div className="up-split">
            <div>
              <div className="k"><i style={{ background: '#C9C5B9' }} />{t('notCounted')}</div>
              <div className="v mono">{notCountedCount.toLocaleString()}</div>
            </div>
            <div>
              <div className="k"><i style={{ background: 'var(--warning-color)' }} />{t('counted')}</div>
              <div className="v mono">{countedCount.toLocaleString()}</div>
            </div>
            <div>
              <div className="k"><i style={{ background: 'var(--success-color)' }} />{t('verified')}</div>
              <div className="v mono">{verifiedCount.toLocaleString()}</div>
            </div>
          </div>
        </section>

        <section className="up-filters">
          <div>
            <label htmlFor="progress-status-filter" className="ds-label">{t('status')}</label>
            <select id="progress-status-filter" className="ds-fld" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('allStatuses') || 'All Statuses'}</option>
              <option value="Not Counted">{t('notCounted')}</option>
              <option value="Counted">{t('counted')}</option>
              <option value="Verified">{t('verified')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="progress-location-filter" className="ds-label">{t('location')}</label>
            <select id="progress-location-filter" className="ds-fld" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="all">{t('allLocations') || 'All Locations'}</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
          <button type="button" className="ds-btn outline" onClick={handleDownloadCSV} style={{ gridColumn: '1 / -1' }}>
            <Download size={18} /> {t('downloadCsv') || 'Download CSV'}
          </button>
        </section>

        <div className="ds-section-label">
          <h2 style={{ margin: 0, fontSize: '1.0625rem' }}>{t('recentActivity')}</h2>
          <span className="hint"><span className="mono">{filteredParts.length.toLocaleString()}</span> {t('items').toLowerCase()}</span>
        </div>

        <section className="ds-card">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Skeleton width="45%" height="1rem" />
                  <Skeleton width="70%" height="0.75rem" />
                </div>
              ))}
            </div>
          ) : filteredParts.length === 0 ? (
            <EmptyState icon={<PackageSearch size={36} strokeWidth={1.5} />} message={t('noParts') || 'No activity found.'} />
          ) : (
            <ol className="up-list">
              {paginatedParts.map((p, index) => {
                const zone = ZONE_THEME[p._table];
                return (
                  <li key={`${p.id}-${index}`}>
                    <span className="bar" style={{ background: zone?.accent || 'var(--primary-color)' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                        <div className="mono" style={{ fontSize: '0.9375rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.material || p.part_no || '-'}</div>
                        <span className={`ds-chip ${getStatusChipClass(p.status)}`}>{statusLabel(p.status)}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', alignItems: 'center', marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 800, color: zone?.accent }}>{zone?.code || p._table}</span>
                        <span className="mono">{p.location || p.rack_number || p.storage_bin || '-'}</span>
                        <span>·</span>
                        <span>{t('verifiedBy')}: <b style={{ color: 'var(--text-primary)' }}>{p.verify_by || '—'}</b></span>
                        {p.batch_id && <span className="mono">· {new Date(p.batch_id).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        <p style={{ textAlign: 'center', padding: '1.25rem 0 0', fontSize: '0.75rem' }}>
          {t('showingLatestUpdates') || 'Report generated on'} {new Date().toLocaleString()}.
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
