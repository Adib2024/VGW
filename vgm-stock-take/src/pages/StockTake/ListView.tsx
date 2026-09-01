import { useState, useEffect, useRef, useMemo, KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navigation } from '../../components/Navigation';
import { useLanguage } from '../../contexts/LanguageContext';
import { Part } from '../../types/database';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { fetchAllRows } from '../../lib/supabase';
import { useRealtimeTables } from '../../hooks/useRealtimeTables';
import { ZONE_THEME, NEUTRAL_ZONE_THEME } from '../../lib/zoneTheme';
import { Search, PackageSearch } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { BottomNav } from '../../components/ui/BottomNav';
import { getStatusColor, getStatusBadgeColors } from '../../lib/statusColor';

const ALL_ZONE_TABLES = ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];

export default function StockTakeListView() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table');

  const [parts, setParts] = useState<Part[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, completed: 0, percentage: 0 });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const isMounted = useRef(true);

  const zoneTheme = (tableParam && ZONE_THEME[tableParam]) || NEUTRAL_ZONE_THEME;
  const pageTitle = tableParam === 'check_part' ? 'Check Part' : tableParam ? zoneTheme.title : 'All Zones';

  const goToPart = (part: any, displayNo: number) => navigate(`/stock-take/count/${part._table}/${part.id}?no=${displayNo}`);
  const handlePartKeyDown = (e: KeyboardEvent, part: any, displayNo: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToPart(part, displayNo);
    }
  };

  useEffect(() => {
    const handleResize = () => isMounted.current && setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchParts();
    return () => { isMounted.current = false; };
  }, [tableParam, selectedBatch]);

  const tablesToWatch = tableParam ? [tableParam] : ALL_ZONE_TABLES;
  useRealtimeTables(tablesToWatch, () => fetchParts());

  const fetchParts = async () => {
    try {
      const tablesToFetch = tableParam ? [tableParam] : ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];
      const promises = tablesToFetch.map(table => fetchAllRows(table));
      const results = await Promise.all(promises);

      let combinedParts: any[] = [];
      results.forEach((res, index) => {
        if (res && res.length > 0) {
          const tableData = res.map((p: any) => ({ ...p, _table: tablesToFetch[index] }));
          combinedParts = [...combinedParts, ...tableData];
        }
      });

      // Extract unique batches and sort them newest first
      const allBatches = [...new Set(combinedParts.map(p => p.batch_id || p.metadata?.batch_id).filter(Boolean))] as string[];
      allBatches.sort().reverse();

      const currentBatch = selectedBatch || allBatches[0];

      const currentParts = currentBatch
        ? combinedParts.filter(p => (p.batch_id === currentBatch || p.metadata?.batch_id === currentBatch))
        : combinedParts;

      const total = currentParts.length;
      const completed = currentParts.filter(p => p.status === 'Verified').length;
      const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

      if (isMounted.current) {
        setBatches(allBatches);
        if (!selectedBatch && allBatches.length > 0) setSelectedBatch(allBatches[0]);
        setParts(currentParts);
        setStats({ total, completed, percentage });
      }

    } catch (err: any) {
      console.error('Error fetching parts:', err);
      // Otherwise a real fetch failure renders identically to "no parts
      // uploaded yet" - the empty state, with nothing telling the user why.
      addToast(err?.message || 'Failed to load parts.', 'error');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const getDisplayColumns = () => {
    if (parts.length === 0) return [];

    // Explicitly configure columns per zone requirement
    switch (tableParam) {
      case 'b17':
        return ['material', 'rack_number'];
      case 'b22':
        return ['material', 'location'];
      case 'b22_seq':
        return ['material', 'location'];
      case 'loma':
        return ['material', 'storage_bin'];
      default:
        // Fallback for global view or check_part:
        const sample = parts[0];
        const exclude = ['id', 'batch_id', 'status', '_table', 'metadata', 'no', 'csv_status', 'verify_by', 'remark'];
        return Object.keys(sample).filter(k => !exclude.includes(k) && !/box|seq|recount|unknown|luqman|nisha/i.test(k)).slice(0, 3);
    }
  };

  const displayColumns = getDisplayColumns();
  const locationColName = displayColumns[1];
  const uniqueLocations = locationColName ? [...new Set(parts.map(p => p[locationColName]).filter(Boolean))] as string[] : [];
  uniqueLocations.sort();

  const statusCounts = useMemo(() => ({
    notCounted: parts.filter(p => p.status === 'Not Counted').length,
    counted: parts.filter(p => p.status === 'Counted').length,
    verified: parts.filter(p => p.status === 'Verified').length,
  }), [parts]);

  const filteredParts = parts.filter(p => {
    const searchLower = search.toLowerCase();

    // 1. Search Match
    const matchesSearch = search === '' || Object.values(p).some(val =>
      val && typeof val === 'string' && val.toLowerCase().includes(searchLower)
    );

    // 2. Status Match
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    // 3. Location / Rack Match
    const matchesLocation = locationFilter === 'all' || (locationColName && p[locationColName] === locationFilter);

    return matchesSearch && matchesStatus && matchesLocation;
  });

  const totalPages = Math.max(1, Math.ceil(filteredParts.length / PAGE_SIZE));
  const paginatedParts = filteredParts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, locationFilter, tableParam]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .lv-panel {
          position: relative;
          background: var(--surface-color);
          border-radius: var(--radius-panel);
          box-shadow: 0 10px 30px -8px rgba(var(--primary-color-rgb), 0.12), 0 2px 8px -2px rgba(var(--primary-color-rgb), 0.05);
          overflow: hidden;
          margin-bottom: 1.25rem;
        }
        .lv-panel::before, .lv-panel::after { content: ''; position: absolute; width: 14px; height: 14px; opacity: 0.5; }
        .lv-panel::before { top: 10px; left: 10px; border-top: 2px solid var(--zc); border-left: 2px solid var(--zc); border-radius: 3px 0 0 0; }
        .lv-panel::after { bottom: 10px; right: 10px; border-bottom: 2px solid var(--zc); border-right: 2px solid var(--zc); border-radius: 0 0 3px 0; }

        .lv-panel-top { padding: 1.5rem 1.6rem 1.25rem; display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: center; justify-content: space-between; }
        .lv-zone-id { display: flex; align-items: center; gap: 0.9rem; }
        .lv-zone-icon {
          width: 46px; height: 46px; border-radius: var(--radius-card); flex-shrink: 0;
          background: var(--zc-soft); box-shadow: inset 0 0 0 1.5px var(--zc);
          display: flex; align-items: center; justify-content: center;
        }
        .lv-zone-icon img { width: 26px; height: 26px; }
        .lv-zone-id h1 { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em; color: var(--primary-color); margin: 0; }
        .lv-zone-id .lv-sub { font-size: 0.78rem; color: var(--text-secondary); font-weight: 500; margin-top: 0.15rem; font-variant-numeric: tabular-nums; }

        .lv-chips { display: flex; gap: 0.6rem; flex-wrap: wrap; }
        .lv-chip { display: flex; flex-direction: column; align-items: flex-end; padding: 0.5rem 0.85rem; border-radius: var(--radius-card); min-width: 72px; }
        .lv-chip .lv-chip-n { font-size: 1.05rem; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
        .lv-chip .lv-chip-l { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.3rem; }
        .lv-chip.bad { background: var(--danger-bg); } .lv-chip.bad .lv-chip-n, .lv-chip.bad .lv-chip-l { color: var(--danger-text); }
        .lv-chip.warn { background: var(--warning-bg); } .lv-chip.warn .lv-chip-n, .lv-chip.warn .lv-chip-l { color: var(--warning-text); }
        .lv-chip.ok { background: var(--success-bg); } .lv-chip.ok .lv-chip-n, .lv-chip.ok .lv-chip-l { color: var(--success-text); }

        .lv-panel-progress { padding: 0 1.6rem 1.4rem; }
        .lv-pp-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
        .lv-pp-row .lv-label { font-size: 0.68rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .lv-pp-row .lv-pct { font-size: 0.95rem; font-weight: 700; color: var(--primary-color); font-variant-numeric: tabular-nums; }
        .lv-bar-track { position: relative; height: 44px; overflow: hidden; }
        .lv-bar-base { position: absolute; bottom: 4px; width: 100%; height: 7px; border-radius: var(--radius-full); background: rgba(var(--primary-color-rgb), 0.08); overflow: hidden; }
        .lv-bar-fill { height: 100%; border-radius: var(--radius-full); background: var(--zc); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }

        .lv-controls { border-top: 1px solid var(--surface-highlight); padding: 1.1rem 1.6rem; display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .lv-search { flex: 1 1 240px; position: relative; display: flex; align-items: center; }
        .lv-search svg { position: absolute; left: 0.9rem; color: var(--text-secondary); pointer-events: none; }
        .lv-search input {
          width: 100%; padding: 0.65rem 1rem 0.65rem 2.4rem; border-radius: var(--radius-md);
          border: 1px solid var(--border-color); background: var(--surface-highlight); font-size: 0.88rem;
          font-family: inherit; outline: none; color: var(--text-primary);
        }
        .lv-select {
          padding: 0.65rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);
          background: var(--surface-color); font-size: 0.85rem; font-weight: 600; color: var(--text-primary);
          font-family: inherit; cursor: pointer; outline: none;
        }

        .lv-ledger {
          background: var(--surface-color); border-radius: var(--radius-panel);
          box-shadow: 0 10px 30px -8px rgba(var(--primary-color-rgb), 0.12), 0 2px 8px -2px rgba(var(--primary-color-rgb), 0.05);
          overflow: hidden;
        }
        .lv-table { width: 100%; min-width: 800px; border-collapse: collapse; }
        .lv-table thead th {
          text-align: left; padding: 0.9rem 1.5rem; font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--text-secondary); border-bottom: 1px solid var(--surface-highlight);
        }
        .lv-table tbody tr { border-bottom: 1px solid #f8fafc; cursor: pointer; transition: background 0.15s; }
        .lv-table tbody tr:hover { background: var(--surface-highlight); }
        .lv-table tbody tr:last-child { border-bottom: none; }
        .lv-table td { padding: 0.9rem 1.5rem; font-size: 0.88rem; color: var(--text-primary); font-weight: 500; }
        .lv-table td.lv-no { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--text-secondary); position: relative; }
        .lv-table td.lv-no::before {
          content: ''; position: absolute; left: 0; top: 0.4rem; bottom: 0.4rem; width: 4px;
          border-radius: 0 4px 4px 0; background: var(--row-accent);
        }
        .lv-status-pill { display: inline-flex; padding: 0.28rem 0.7rem; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; }

        .lv-mobile-card { background: var(--surface-color); border-radius: var(--radius-card); padding: 1.25rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-left: 4px solid var(--row-accent); cursor: pointer; }
      `}</style>

      <Navigation
        title={pageTitle}
        backTo="/stock-take"
      />

      <main className="container flex-col" style={{ flex: 1, padding: '1.5rem 1rem 6rem', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>

        {!loading && (
          <div className="lv-panel" style={{ ['--zc' as any]: zoneTheme.accent, ['--zc-soft' as any]: zoneTheme.accentSoft }}>
            <div className="lv-panel-top">
              <div className="lv-zone-id">
                <div className="lv-zone-icon"><img src="/vw-logo.svg" alt="VW" /></div>
                <div>
                  <h1>{pageTitle}</h1>
                  <div className="lv-sub">
                    {stats.total.toLocaleString()} {t('items')}
                    {selectedBatch ? ` · ${new Date(selectedBatch).toLocaleDateString()}` : ''}
                  </div>
                </div>
              </div>
              <div className="lv-chips">
                <div className="lv-chip bad"><span className="lv-chip-n">{statusCounts.notCounted}</span><span className="lv-chip-l">{t('notCounted')}</span></div>
                <div className="lv-chip warn"><span className="lv-chip-n">{statusCounts.counted}</span><span className="lv-chip-l">{t('counted')}</span></div>
                <div className="lv-chip ok"><span className="lv-chip-n">{statusCounts.verified}</span><span className="lv-chip-l">{t('verified')}</span></div>
              </div>
            </div>

            <div className="lv-panel-progress">
              <div className="lv-pp-row">
                <span className="lv-label">{t('overallProgress')}</span>
                <span className="lv-pct">{stats.percentage}%</span>
              </div>
              <div className="lv-bar-track">
                <div className="lv-bar-base"><div className="lv-bar-fill" style={{ width: `${stats.percentage}%` }} /></div>
                <div className="car-icon-anim" style={{ bottom: '8px', animationDelay: zoneTheme.carDelay, animationDuration: zoneTheme.carDuration }}>
                  <img src="/car-golf.webp" alt="car" decoding="async" style={{ width: '80px', height: 'auto', objectFit: 'contain' }} />
                </div>
              </div>
            </div>

            <div className="lv-controls">
              <div className="lv-search">
                <Search size={16} />
                <input placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>

              {user?.role === 'Admin' && batches.length > 0 && (
                <select
                  className="lv-select"
                  value={selectedBatch}
                  onChange={(e) => {
                    setSelectedBatch(e.target.value);
                    setTimeout(fetchParts, 0);
                  }}
                  style={{ minWidth: '220px' }}
                >
                  {batches.map((batch, index) => (
                    <option key={batch} value={batch}>
                      {index === 0 ? `Latest Upload (${new Date(batch).toLocaleDateString()})` : `Old Upload (${new Date(batch).toLocaleDateString()})`}
                    </option>
                  ))}
                </select>
              )}

              <select className="lv-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: '150px' }}>
                <option value="all">All Status</option>
                <option value="Not Counted">Not Counted</option>
                <option value="Counted">Counted</option>
                <option value="Verified">Verified</option>
              </select>

              {locationColName && uniqueLocations.length > 0 && (
                <select className="lv-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={{ minWidth: '150px' }}>
                  <option value="all">All {locationColName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        <div className="lv-ledger">
          <div style={{ padding: isMobile ? '1rem' : '0' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.25rem', backgroundColor: '#fff', borderRadius: 'var(--radius-card)', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    <Skeleton width="40%" height="1.25rem" />
                    <Skeleton width="70%" height="0.875rem" />
                    <Skeleton width="55%" height="0.875rem" />
                  </div>
                ))}
              </div>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {paginatedParts.map((part: any, index) => {
                  const displayNo = (page - 1) * PAGE_SIZE + index + 1;
                  const badge = getStatusBadgeColors(part.status);
                  return (
                  <div
                    key={part.id}
                    onClick={() => goToPart(part, displayNo)}
                    onKeyDown={(e) => handlePartKeyDown(e, part, displayNo)}
                    role="button"
                    tabIndex={0}
                    className="lv-mobile-card"
                    style={{ ['--row-accent' as any]: getStatusColor(part.status) }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>#{displayNo}</span>
                      <span className="lv-status-pill" style={{ backgroundColor: badge.bg, color: badge.text }}>{part.status}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {displayColumns.map(col => (
                        <div key={col} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>{col.replace(/_/g, ' ')}</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{part[col] || (part.metadata && part.metadata[col]) || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })}
                {filteredParts.length === 0 && <EmptyState icon={<PackageSearch size={40} strokeWidth={1.5} />} message={t('noParts')} />}
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="lv-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      {displayColumns.map(col => (
                        <th key={col}>{col.replace(/_/g, ' ')}</th>
                      ))}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedParts.map((part: any, index) => {
                      const displayNo = (page - 1) * PAGE_SIZE + index + 1;
                      const badge = getStatusBadgeColors(part.status);
                      return (
                      <tr
                        key={part.id}
                        onClick={() => goToPart(part, displayNo)}
                        onKeyDown={(e) => handlePartKeyDown(e, part, displayNo)}
                        role="button"
                        tabIndex={0}
                        style={{ ['--row-accent' as any]: getStatusColor(part.status) }}
                      >
                        <td className="lv-no">{displayNo}</td>

                        {displayColumns.map(col => (
                          <td key={col}>{part[col] || (part.metadata && part.metadata[col]) || '-'}</td>
                        ))}

                        <td>
                          <span className="lv-status-pill" style={{ backgroundColor: badge.bg, color: badge.text }}>{part.status}</span>
                        </td>
                      </tr>
                      );
                    })}
                    {filteredParts.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState icon={<PackageSearch size={40} strokeWidth={1.5} />} message={t('noParts')} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
