import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navigation } from '../../components/Navigation';
import { useLanguage } from '../../contexts/LanguageContext';
import { Part } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { supabase, fetchAllRows } from '../../lib/supabase';
import { Search } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';

export default function StockTakeListView() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table');

  const [parts, setParts] = useState<Part[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, completed: 0, percentage: 0 });

  useEffect(() => {
    fetchParts();

    const tablesToWatch = tableParam ? [tableParam] : ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];
    const channels = tablesToWatch.map(table =>
      supabase
        .channel(`${table}-list`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, () => {
          fetchParts();
        })
        .subscribe()
    );

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [tableParam, selectedBatch]);

  const fetchParts = async () => {
    try {
      const tablesToFetch = tableParam ? [tableParam] : ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];
      const promises = tablesToFetch.map(table => fetchAllRows(table, 'id'));
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
      setBatches(allBatches);

      // Select the latest batch by default if none is selected
      const currentBatch = selectedBatch || allBatches[0];
      if (!selectedBatch && allBatches.length > 0) {
        setSelectedBatch(allBatches[0]);
      }

      // Filter by the selected batch (or latest if none selected)
      const currentParts = currentBatch
        ? combinedParts.filter(p => (p.batch_id === currentBatch || p.metadata?.batch_id === currentBatch))
        : combinedParts; // Fallback for old data without batch_id

      setParts(currentParts);

      // Compute stats
      const total = currentParts.length;
      const completed = currentParts.filter(p => p.status === 'Verified' || p.status === 'Counted').length;
      const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
      setStats({ total, completed, percentage });

    } catch (err) {
      console.error('Error fetching parts:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter(p => {
    const searchLower = search.toLowerCase();
    // Search across all string values in the part object
    return Object.values(p).some(val =>
      val && typeof val === 'string' && val.toLowerCase().includes(searchLower)
    );
  });

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



  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation 
        title={`List View${tableParam ? ` - LOCATION ${tableParam.toUpperCase().replace('_', ' ')}` : ''}`} 
        backTo="/stock-take" 
      />

      <main className="container flex-col gap-6" style={{ flex: 1, padding: '2rem 1rem' }}>

        {/* Progress Bar with Car Animation */}
        {!loading && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#666' }}>
                {stats.percentage}% ({stats.completed}/{stats.total})
              </div>
              <button style={{ color: '#1877f2', fontSize: '0.75rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Click for Status
              </button>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '80px', overflow: 'hidden' }}>
              {/* The driving car */}
              <div
                className="driving-car"
                style={{
                  position: 'absolute',
                  top: '10px',
                  width: '80px',
                  height: '40px',
                  backgroundImage: 'url("https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg")',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  animationDelay: '0s',
                  animationDuration: '6s'
                }}
              />

              {/* The progress line */}
              <div style={{ position: 'absolute', bottom: '10px', width: '100%', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    backgroundColor: '#2ecc71',
                    width: `${stats.percentage}%`,
                    transition: 'width 0.5s ease-out'
                  }}
                />
              </div>
            </div>
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

            <select
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                outline: 'none',
                minWidth: '200px'
              }}
            >
              <option value="all">All Groups</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto', padding: '1.5rem' }}>
            {loading ? (
              <p style={{ textAlign: 'center', padding: '2rem' }}>{t('loadingParts')}</p>
            ) : (
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
                  {filteredParts.map((part: any, index) => (
                    <tr
                      key={part.id}
                      onClick={() => navigate(`/stock-take/count/${part._table}/${part.id}`)}
                      style={{ backgroundColor: '#fff', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <td style={{ padding: '1rem', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', borderLeft: '4px solid #2ecc71', fontWeight: 800, color: '#333' }}>
                        {index + 1}
                      </td>

                      {displayColumns.map(col => (
                        <td key={col} style={{ padding: '1rem', fontWeight: 500, color: '#333' }}>
                          {part[col] || (part.metadata && part.metadata[col]) || '-'}
                        </td>
                      ))}

                      <td style={{ padding: '1rem', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}>
                        <div
                          style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '4px',
                            border: `1px solid ${part.status === 'Verified' ? '#2ecc71' : part.status === 'Counted' ? '#f39c12' : '#e74c3c'}`,
                            color: part.status === 'Verified' ? '#2ecc71' : part.status === 'Counted' ? '#f39c12' : '#e74c3c',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          {part.status}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredParts.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>{t('noParts')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
