import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navigation } from '../../components/Navigation';
import { useLanguage } from '../../contexts/LanguageContext';
import { Part } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { supabase, fetchAllRows } from '../../lib/supabase';
import { Search, PackageSearch } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BottomNav } from '../../components/ui/BottomNav';
import { getStatusColor } from '../../lib/statusColor';

export default function StockTakeListView() {
  const { t } = useLanguage();
  const { user } = useAuth();
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

    const tablesToWatch = tableParam ? [tableParam] : ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];
    const channels = tablesToWatch.map(table =>
      supabase
        .channel(`${table}-list`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, () => {
          if (isMounted.current) fetchParts();
        })
        .subscribe()
    );

    return () => {
      isMounted.current = false;
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [tableParam, selectedBatch]);

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
      const completed = currentParts.filter(p => p.status === 'Verified' || p.status === 'Counted').length;
      const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

      if (isMounted.current) {
        setBatches(allBatches);
        if (!selectedBatch && allBatches.length > 0) setSelectedBatch(allBatches[0]);
        setParts(currentParts);
        setStats({ total, completed, percentage });
      }

    } catch (err) {
      console.error('Error fetching parts:', err);
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
      <Navigation 
        title="List View" 
        backTo="/stock-take" 
      />

      <main className="container flex-col gap-6" style={{ flex: 1, padding: '2rem 1rem 6rem' }}>

        {/* Progress Bar with Car Animation */}
        {!loading && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#666' }}>
                {stats.percentage}% ({stats.completed}/{stats.total})
              </div>
              <button style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Click for Status
              </button>
            </div>

            <ProgressBar percentage={stats.percentage} showCar={true} />
          </div>
        )}

        <Card style={{ padding: '0' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <Input
                icon={<Search size={18} />}
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Show History Dropdown for Admins */}
            {user?.role === 'Admin' && batches.length > 0 && (
              <select
                value={selectedBatch}
                onChange={(e) => {
                  setSelectedBatch(e.target.value);
                  // Refetch to apply the new selected batch
                  setTimeout(fetchParts, 0);
                }}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-md)',
                  color: '#0f172a',
                  fontWeight: 600,
                  outline: 'none',
                  minWidth: '220px',
                  cursor: 'pointer'
                }}
              >
                {batches.map((batch, index) => (
                  <option key={batch} value={batch}>
                    {index === 0 ? `Latest Upload (${new Date(batch).toLocaleDateString()})` : `Old Upload (${new Date(batch).toLocaleDateString()})`}
                  </option>
                ))}
              </select>
            )}

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                outline: 'none',
                minWidth: '160px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Status</option>
              <option value="Not Counted">Not Counted</option>
              <option value="Counted">Counted</option>
              <option value="Verified">Verified</option>
            </select>

            {/* Location / Rack Filter Dropdown */}
            {locationColName && uniqueLocations.length > 0 && (
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  minWidth: '160px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All {locationColName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                  return (
                  <div
                    key={part.id}
                    onClick={() => goToPart(part, displayNo)}
                    onKeyDown={(e) => handlePartKeyDown(e, part, displayNo)}
                    role="button"
                    tabIndex={0}
                    style={{ backgroundColor: '#fff', borderRadius: 'var(--radius-card)', padding: '1.25rem', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', borderLeft: `6px solid ${getStatusColor(part.status)}`, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#0f172a' }}>#{displayNo}</span>
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-xs)', border: `1px solid ${getStatusColor(part.status)}`, color: getStatusColor(part.status), fontSize: '0.75rem', fontWeight: 700 }}>
                        {part.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {displayColumns.map(col => (
                        <div key={col} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                          <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>{col.replace(/_/g, ' ')}</span>
                          <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem' }}>{part[col] || (part.metadata && part.metadata[col]) || '-'}</span>
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
                <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                  <thead>
                    <tr style={{ color: '#666', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 1rem' }}>NO</th>
                      {displayColumns.map(col => (
                        <th key={col} style={{ padding: '0.5rem 1rem' }}>{col.replace(/_/g, ' ')}</th>
                      ))}
                      <th style={{ padding: '0.5rem 1rem' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedParts.map((part: any, index) => {
                      const displayNo = (page - 1) * PAGE_SIZE + index + 1;
                      return (
                      <tr
                        key={part.id}
                        onClick={() => goToPart(part, displayNo)}
                        onKeyDown={(e) => handlePartKeyDown(e, part, displayNo)}
                        role="button"
                        tabIndex={0}
                        style={{ backgroundColor: '#fff', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        <td style={{ padding: '1rem', borderTopLeftRadius: 'var(--radius-md)', borderBottomLeftRadius: 'var(--radius-md)', borderLeft: `4px solid ${getStatusColor(part.status)}`, fontWeight: 800, color: '#333' }}>
                          {displayNo}
                        </td>

                        {displayColumns.map(col => (
                          <td key={col} style={{ padding: '1rem', fontWeight: 500, color: '#333' }}>
                            {part[col] || (part.metadata && part.metadata[col]) || '-'}
                          </td>
                        ))}

                        <td style={{ padding: '1rem', borderTopRightRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)' }}>
                          <div
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.75rem',
                              borderRadius: 'var(--radius-xs)',
                              border: `1px solid ${getStatusColor(part.status)}`,
                              color: getStatusColor(part.status),
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            {part.status}
                          </div>
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
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
