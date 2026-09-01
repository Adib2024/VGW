import { useState, useEffect, useRef } from 'react';
import { Navigation } from '../../components/Navigation';
import { Button } from '../../components/ui/Button';
import { supabase, fetchAllRows } from '../../lib/supabase';
import { Download, PackageSearch } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { BottomNav } from '../../components/ui/BottomNav';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { getStatusColor, getStatusBadgeColors } from '../../lib/statusColor';


export default function UserProgress() {
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const reportRef = useRef<HTMLDivElement>(null);
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
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const verifiedPercentage = parts.length ? Math.round((verifiedCount / parts.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .up-panel {
          position: relative;
          background: var(--surface-color);
          border-radius: var(--radius-panel);
          box-shadow: 0 10px 30px -8px rgba(var(--primary-color-rgb), 0.12), 0 2px 8px -2px rgba(var(--primary-color-rgb), 0.05);
          overflow: hidden;
        }
        .up-panel::before, .up-panel::after { content: ''; position: absolute; width: 14px; height: 14px; opacity: 0.5; }
        .up-panel::before { top: 10px; left: 10px; border-top: 2px solid var(--primary-color); border-left: 2px solid var(--primary-color); border-radius: 3px 0 0 0; }
        .up-panel::after { bottom: 10px; right: 10px; border-bottom: 2px solid var(--primary-color); border-right: 2px solid var(--primary-color); border-radius: 0 0 3px 0; }

        .up-identity { display: flex; align-items: center; gap: 1.1rem; padding: 1.4rem 1.6rem; flex-wrap: wrap; }
        .up-avatar {
          width: 52px; height: 52px; border-radius: 50%; background: var(--primary-color); color: #fff;
          display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; flex-shrink: 0;
        }
        .up-identity-name { font-size: 1.05rem; font-weight: 700; color: var(--primary-color); }
        .up-identity-role { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); margin-top: 0.15rem; }
        .up-sessions { display: flex; gap: 2rem; margin-left: auto; flex-wrap: wrap; }
        .up-session .l { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-secondary); }
        .up-session .v { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-top: 0.25rem; font-variant-numeric: tabular-nums; }
        .up-session .via { font-size: 0.7rem; color: var(--text-secondary); font-weight: 500; margin-top: 0.1rem; }

        .up-report-head { padding: 1.5rem 1.6rem 1.25rem; border-top: 1px solid var(--surface-highlight); }
        .up-eyebrow { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-secondary); margin-bottom: 0.35rem; }
        .up-report-title { font-size: 1.3rem; font-weight: 800; color: var(--primary-color); letter-spacing: -0.01em; }

        .up-stat-row { display: flex; gap: 0.75rem; padding: 0 1.6rem 1.4rem; flex-wrap: wrap; }
        .up-stat-chip { flex: 1 1 140px; border-radius: var(--radius-lg); padding: 1rem 1.1rem; }
        .up-stat-chip .up-n { font-size: 1.6rem; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
        .up-stat-chip .up-l { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.4rem; }
        .up-stat-chip.bad { background: var(--danger-bg); } .up-stat-chip.bad .up-n, .up-stat-chip.bad .up-l { color: var(--danger-text); }
        .up-stat-chip.warn { background: var(--warning-bg); } .up-stat-chip.warn .up-n, .up-stat-chip.warn .up-l { color: var(--warning-text); }
        .up-stat-chip.ok { background: var(--success-bg); } .up-stat-chip.ok .up-n, .up-stat-chip.ok .up-l { color: var(--success-text); }

        .up-totals { padding: 0 1.6rem 1.5rem; }
        .up-totals-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.3rem; }
        .up-totals-figure { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }
        .up-totals-sub { font-size: 0.85rem; color: var(--text-secondary); font-weight: 600; font-variant-numeric: tabular-nums; }
        .up-totals-bar { height: 10px; border-radius: var(--radius-full); background: rgba(var(--primary-color-rgb), 0.08); overflow: hidden; }
        .up-totals-fill { height: 100%; border-radius: var(--radius-full); background: var(--success-color); transition: width 0.5s ease-in-out; }

        .up-filters { border-top: 1px solid var(--surface-highlight); padding: 1.1rem 1.6rem; display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .up-filters .field { display: flex; flex-direction: column; gap: 0.4rem; flex: 1 1 200px; }
        .up-filters label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
        .up-filters select {
          padding: 0.65rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);
          background: var(--surface-color); font-size: 0.85rem; font-weight: 600; color: var(--text-primary);
          font-family: inherit; cursor: pointer; outline: none;
        }

        .up-ledger-title { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); padding: 1.4rem 1.6rem 0.9rem; }
        .up-table { width: 100%; font-size: 0.875rem; min-width: 600px; border-collapse: collapse; }
        .up-table thead th { text-align: left; padding: 0.8rem 1.6rem; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); border-bottom: 1px solid var(--surface-highlight); }
        .up-table tbody tr { border-bottom: 1px solid #f8fafc; }
        .up-table tbody tr:last-child { border-bottom: none; }
        .up-table td { padding: 0.85rem 1.6rem; color: var(--text-primary); font-weight: 500; }
        .up-table td.up-mat { font-weight: 700; position: relative; }
        .up-table td.up-mat::before { content: ''; position: absolute; left: 0; top: 0.35rem; bottom: 0.35rem; width: 4px; border-radius: 0 4px 4px 0; background: var(--row-accent); }
        .up-zone-tag { font-size: 0.62rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; margin-left: 0.4rem; }
        .up-status-pill { display: inline-flex; padding: 0.26rem 0.65rem; border-radius: var(--radius-full); font-size: 0.7rem; font-weight: 700; }

        .up-mobile-card { background: var(--surface-color); border-radius: var(--radius-card); padding: 1.25rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 6px solid var(--row-accent); }
        .up-foot-note { text-align: center; padding: 1.4rem; font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; }
      `}</style>

      <Navigation title={t('userProgressReport') || 'User Progress Report'} backTo="/stock-take" />

      <main className="container flex-col" style={{ flex: 1, padding: '1.5rem 1rem 6rem', maxWidth: '1080px', margin: '0 auto', width: '100%', gap: '1.25rem', display: 'flex' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleDownloadCSV}>
            <Download size={18} /> {t('downloadCsv') || 'Download CSV'}
          </Button>
        </div>

        <div className="up-panel">
          <div className="up-identity">
            <div className="up-avatar">{user?.name?.charAt(0).toUpperCase() || user?.id?.charAt(0).toUpperCase() || 'U'}</div>
            <div>
              <div className="up-identity-name">{user?.name || '-'}</div>
              <div className="up-identity-role">{user?.role || '-'}</div>
            </div>
            <div className="up-sessions">
              <div className="up-session">
                <div className="l">{t('lastLogin') || 'Last Login'}</div>
                <div className="v">{lastLogin}</div>
                {loginDevice !== '-' && <div className="via">via {loginDevice}</div>}
              </div>
              <div className="up-session">
                <div className="l">{t('lastLogout') || 'Last Logout'}</div>
                <div className="v">{lastLogout}</div>
                {logoutDevice !== '-' && <div className="via">via {logoutDevice}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="up-panel" ref={reportRef}>
          <div className="up-report-head">
            <div className="up-eyebrow">VGM CKD &middot; Progress Summary</div>
            <div className="up-report-title">{t('allLocations') || 'All Locations'} &middot; {parts.length.toLocaleString()} {t('items')}</div>
          </div>

          <div className="up-stat-row">
            <div className="up-stat-chip bad"><div className="up-n">{notCountedCount.toLocaleString()}</div><div className="up-l">{t('notCounted')}</div></div>
            <div className="up-stat-chip warn"><div className="up-n">{countedCount.toLocaleString()}</div><div className="up-l">{t('counted')}</div></div>
            <div className="up-stat-chip ok"><div className="up-n">{verifiedCount.toLocaleString()}</div><div className="up-l">{t('verified')}</div></div>
          </div>

          <div className="up-totals">
            <div className="up-totals-row">
              <span className="up-totals-figure">{verifiedPercentage}%</span>
              <span className="up-totals-sub">{verifiedCount.toLocaleString()} / {parts.length.toLocaleString()} {t('verified').toLowerCase()}</span>
            </div>
            <div className="up-totals-bar"><div className="up-totals-fill" style={{ width: `${verifiedPercentage}%` }} /></div>
          </div>

          <div className="up-filters">
            <div className="field">
              <label htmlFor="progress-status-filter">{t('filterByStatus') || 'Filter by Status'}</label>
              <select id="progress-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">{t('allStatuses') || 'All Statuses'}</option>
                <option value="Not Counted">{t('notCounted')}</option>
                <option value="Counted">{t('counted')}</option>
                <option value="Verified">{t('verified')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="progress-location-filter">{t('filterByLocation') || 'Filter by Location'}</label>
              <select id="progress-location-filter" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                <option value="all">{t('allLocations') || 'All Locations'}</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="up-panel">
          <div className="up-ledger-title">{t('recentActivity')}</div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1.6rem 1.6rem' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.25rem', backgroundColor: '#fff', borderRadius: 'var(--radius-card)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <Skeleton width="40%" height="1.1rem" />
                  <Skeleton width="65%" height="0.875rem" />
                  <Skeleton width="50%" height="0.875rem" />
                </div>
              ))}
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1.1rem 1.1rem' }}>
              {paginatedParts.map((p, index) => {
                const badge = getStatusBadgeColors(p.status);
                return (
                <div key={`${p.id}-${index}`} className="up-mobile-card" style={{ ['--row-accent' as any]: getStatusColor(p.status) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{p.material || p.part_no || '-'}</span>
                    <span className="up-status-pill" style={{ backgroundColor: badge.bg, color: badge.text }}>{p.status}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>{t('location') || 'Location'} / {t('zone') || 'Zone'}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem', textAlign: 'right' }}>{p.location || p.rack_number || p.storage_bin || '-'} ({p._table})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>{t('verifiedBy') || 'Verified By'}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem', textAlign: 'right' }}>{p.verify_by || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>Batch ID</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem', textAlign: 'right' }}>{p.batch_id ? new Date(p.batch_id).toLocaleString() : '-'}</span>
                    </div>
                  </div>
                </div>
                );
              })}
              {filteredParts.length === 0 && (
                <EmptyState icon={<PackageSearch size={40} strokeWidth={1.5} />} message={t('noParts') || 'No activity found.'} />
              )}
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
              <table className="up-table">
                <thead>
                  <tr>
                    <th>{t('material') || 'Material'}</th>
                    <th>{t('location') || 'Location'} / {t('zone') || 'Zone'}</th>
                    <th>{t('status') || 'Status'}</th>
                    <th>{t('verifiedBy') || 'Verified By'}</th>
                    <th>Batch ID (Date)</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedParts.map((p, index) => {
                    const badge = getStatusBadgeColors(p.status);
                    return (
                    <tr key={`${p.id}-${index}`}>
                      <td className="up-mat" style={{ ['--row-accent' as any]: getStatusColor(p.status) }}>
                        {p.material || p.part_no || '-'}<span className="up-zone-tag">{p._table}</span>
                      </td>
                      <td>{p.location || p.rack_number || p.storage_bin || '-'}</td>
                      <td><span className="up-status-pill" style={{ backgroundColor: badge.bg, color: badge.text }}>{p.status}</span></td>
                      <td>{p.verify_by || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.batch_id ? new Date(p.batch_id).toLocaleString() : '-'}</td>
                    </tr>
                    );
                  })}
                  {filteredParts.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState icon={<PackageSearch size={40} strokeWidth={1.5} />} message={t('noParts') || 'No activity found.'} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
          <div className="up-foot-note">{t('showingLatestUpdates') || 'Showing latest updates. Generated on'} {new Date().toLocaleString()}.</div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
