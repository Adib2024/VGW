import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navigation } from '../../components/Navigation';
import { useLanguage } from '../../contexts/LanguageContext';
import { Part } from '../../types/database';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { CarTrack } from '../../components/ui/CarTrack';
import { fetchRowsIfTableExists } from '../../lib/supabase';
import { useRealtimeTables } from '../../hooks/useRealtimeTables';
import { ZONE_THEME, NEUTRAL_ZONE_THEME } from '../../lib/zoneTheme';
import { Search, PackageSearch } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { BottomNav } from '../../components/ui/BottomNav';
import { getStatusChipClass } from '../../lib/statusColor';

const ALL_ZONE_TABLES = ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];

const prettyCol = (col: string) => col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [zoneMissing, setZoneMissing] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0, percentage: 0 });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const isMounted = useRef(true);

  const zoneTheme = (tableParam && ZONE_THEME[tableParam]) || NEUTRAL_ZONE_THEME;
  const pageTitle = tableParam ? zoneTheme.title : 'All Zones';

  const goToPart = (part: any, displayNo: number) => navigate(`/stock-take/count/${part._table}/${part.id}?no=${displayNo}`);

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
      const promises = tablesToFetch.map(table => fetchRowsIfTableExists(table));
      const results = await Promise.all(promises);
      if (isMounted.current) setZoneMissing(!!tableParam && results[0] === null);

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

  const cellValue = (part: any, col?: string) => (col ? part[col] || (part.metadata && part.metadata[col]) : '') || '';

  // Sum of whatever box columns this zone's table has, so a counted part
  // shows its quantity right in the list.
  const boxTotal = (part: any) => {
    const keys = Object.keys(part).filter(k => /^box/i.test(k));
    const filled = keys.filter(k => part[k] !== null && part[k] !== undefined && part[k] !== '');
    if (filled.length === 0) return null;
    return filled.reduce((sum, k) => sum + (parseInt(part[k]) || 0), 0);
  };

  const filters = [
    { value: 'all', label: 'All', count: parts.length, dot: '' },
    { value: 'Not Counted', label: t('notCounted'), count: statusCounts.notCounted, dot: 'nc' },
    { value: 'Counted', label: t('counted'), count: statusCounts.counted, dot: 'c' },
    { value: 'Verified', label: t('verified'), count: statusCounts.verified, dot: 'v' },
  ];

  const rangeStart = filteredParts.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredParts.length);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .lv-head { display: flex; gap: 1rem; align-items: center; padding: 1rem; margin-top: 0.25rem; }
        .lv-badge {
          width: 84px; height: 84px; border-radius: 16px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; text-align: center;
          color: #fff; font-weight: 900; font-stretch: 70%; line-height: 0.95; padding: 0 6px;
        }
        .lv-controls { display: flex; flex-wrap: wrap; gap: 0.625rem; margin-top: 1rem; }
        .lv-controls .ds-search { flex: 1 1 240px; }
        .lv-controls select { flex: 0 1 180px; min-width: 120px; }
        .lv-list { display: grid; gap: 0.5rem; grid-template-columns: 1fr; }
        @media (min-width: 900px) { .lv-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .lv-row { display: grid !important; grid-template-columns: minmax(0, 1fr) auto; gap: 0.375rem 0.75rem; padding: 0.875rem 1rem; }
        .lv-tag { font-size: 0.6875rem; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: var(--surface-highlight); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
      `}</style>

      <Navigation title={pageTitle} backTo="/stock-take" />

      <main className="ds-page with-nav" style={{ flex: 1 }}>
        {loading ? (
          <div className="ds-card lv-head">
            <Skeleton width="84px" height="84px" borderRadius="16px" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Skeleton width="40%" height="1.75rem" />
              <Skeleton width="100%" height="0.75rem" />
            </div>
          </div>
        ) : (
          <section className="ds-card lv-head">
            <div className="lv-badge" style={{ background: zoneTheme.accent, fontSize: zoneTheme.code.length > 4 ? '1.375rem' : '2.125rem' }}>
              {zoneTheme.code}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div className="mono" style={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 1 }}>
                  {stats.percentage}<span style={{ fontSize: '0.55em', color: 'var(--text-secondary)' }}>%</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('verified').toLowerCase()}</div>
              </div>
              <CarTrack percentage={stats.percentage} color={zoneTheme.accent} carDelay={zoneTheme.carDelay} carDuration={zoneTheme.carDuration} carWidth={64} />
              <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {stats.completed.toLocaleString()} / {stats.total.toLocaleString()} {t('items').toLowerCase()}
                {selectedBatch ? ` · ${new Date(selectedBatch).toLocaleDateString()}` : ''}
              </div>
            </div>
          </section>
        )}

        <div className="lv-controls">
          <div className="ds-search">
            <label htmlFor="lv-search" className="sr-only">{t('search')}</label>
            <Search size={20} />
            <input id="lv-search" className="ds-fld" type="search" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {locationColName && uniqueLocations.length > 0 && (
            <>
              <label htmlFor="lv-location" className="sr-only">{prettyCol(locationColName)}</label>
              <select id="lv-location" className="ds-fld" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                <option value="all">All {prettyCol(locationColName)}</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </>
          )}

          {user?.role === 'Admin' && batches.length > 0 && (
            <>
              <label htmlFor="lv-batch" className="sr-only">Upload batch</label>
              <select
                id="lv-batch"
                className="ds-fld"
                value={selectedBatch}
                onChange={(e) => {
                  setSelectedBatch(e.target.value);
                  setTimeout(fetchParts, 0);
                }}
                style={{ flexBasis: 240 }}
              >
                {batches.map((batch, index) => (
                  <option key={batch} value={batch}>
                    {index === 0 ? `Latest upload (${new Date(batch).toLocaleDateString()})` : `Old upload (${new Date(batch).toLocaleDateString()})`}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="ds-filters" role="group" aria-label="Filter by status" style={{ marginTop: '0.75rem' }}>
          {filters.map(f => (
            <button
              key={f.value}
              type="button"
              className={`ds-filt ${statusFilter === f.value ? 'on' : ''}`}
              aria-pressed={statusFilter === f.value}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.dot && <span className={`dot ${f.dot}`} />}
              {f.label}
              <span className="mono">{f.count.toLocaleString()}</span>
            </button>
          ))}
        </div>

        <div style={{ margin: '1.125rem 0.25rem 0.625rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Showing <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{rangeStart}–{rangeEnd}</span> of <span className="mono">{filteredParts.length.toLocaleString()}</span>
        </div>

        {loading ? (
          <div className="lv-list">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="ds-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Skeleton width="30%" height="0.75rem" />
                <Skeleton width="60%" height="1.125rem" />
                <Skeleton width="45%" height="0.75rem" />
              </div>
            ))}
          </div>
        ) : filteredParts.length === 0 ? (
          <div className="ds-card">
            <EmptyState
              icon={<PackageSearch size={36} strokeWidth={1.5} />}
              message={zoneMissing ? `No parts uploaded for ${zoneTheme.title} yet. An admin can upload them in Admin → Parts upload.` : t('noParts')}
            />
          </div>
        ) : (
          <>
            <div className="lv-list">
              {paginatedParts.map((part: any, index) => {
                const displayNo = (page - 1) * PAGE_SIZE + index + 1;
                const qty = boxTotal(part);
                const main = cellValue(part, displayColumns[0]) || '-';
                const loc = cellValue(part, locationColName);
                const extra = displayColumns.slice(2).map(c => cellValue(part, c)).filter(Boolean).join(' · ');
                return (
                  <button
                    key={part.id}
                    type="button"
                    className="ds-card lv-row"
                    onClick={() => goToPart(part, displayNo)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>#{displayNo}</span>
                      {loc && <span className="lv-tag mono">{loc}</span>}
                      {!tableParam && <span className="lv-tag" style={{ color: ZONE_THEME[part._table]?.accent }}>{ZONE_THEME[part._table]?.code}</span>}
                    </div>
                    <span className={`ds-chip ${getStatusChipClass(part.status)}`} style={{ justifySelf: 'end' }}>{part.status === 'Verified' ? t('verified') : part.status === 'Counted' ? t('counted') : t('notCounted')}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{main}</div>
                      {extra && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extra}</div>}
                    </div>
                    <div style={{ textAlign: 'right', alignSelf: 'end' }}>
                      <div className="eyebrow" style={{ fontSize: '0.625rem', letterSpacing: '0.1em' }}>Qty</div>
                      <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 700 }}>{qty ?? '—'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
