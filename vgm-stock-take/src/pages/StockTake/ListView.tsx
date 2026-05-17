import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navigation } from '../../components/Navigation';
import { useLanguage } from '../../contexts/LanguageContext';
import { Part } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { Search } from 'lucide-react';

export default function StockTakeListView() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table');

  const [parts, setParts] = useState<Part[]>([]);
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
  }, [tableParam]);

  const fetchParts = async () => {
    try {
      const tablesToFetch = tableParam ? [tableParam] : ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];
      const promises = tablesToFetch.map(table => supabase.from(table).select('*').order('part_no', { ascending: true }));
      const results = await Promise.all(promises);
      
      let combinedParts: any[] = [];
      results.forEach((res, index) => {
        if (!res.error && res.data) {
          const tableData = res.data.map(p => ({ ...p, _table: tablesToFetch[index] }));
          combinedParts = [...combinedParts, ...tableData];
        }
      });
        
      setParts(combinedParts);

      // Compute stats
      const total = combinedParts.length;
      const completed = combinedParts.filter(p => p.status === 'Verified' || p.status === 'Counted').length;
      const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
      setStats({ total, completed, percentage });

    } catch (err) {
      console.error('Error fetching parts:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter(p => 
    p.part_no.toLowerCase().includes(search.toLowerCase()) || 
    p.material.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusDot = (status: string) => {
    if (status === 'Verified') return 'status-dot green';
    if (status === 'Counted') return 'status-dot yellow';
    return 'status-dot red'; // Not Counted
  };

  const getStatusText = (status: string) => {
    if (status === 'Verified') return t('verified');
    if (status === 'Counted') return t('counted');
    return t('notCounted');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation title="List View" backTo="/stock-take" />
      
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
                    <th style={{ padding: '0.5rem 1rem' }}>PART NO</th>
                    <th style={{ padding: '0.5rem 1rem' }}>MATERIAL</th>
                    <th style={{ padding: '0.5rem 1rem' }}>LOCATION</th>
                    <th style={{ padding: '0.5rem 1rem' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParts.map((part, index) => (
                    <tr 
                      key={part.id} 
                      onClick={() => navigate(`/stock-take/count/${(part as any)._table}/${part.id}`)}
                      style={{ backgroundColor: '#fff', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <td style={{ padding: '1rem', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', borderLeft: '4px solid #2ecc71', fontWeight: 800, color: '#333' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 500, color: '#333' }}>
                        {part.material}
                      </td>
                      <td style={{ padding: '1rem', color: '#666' }}>
                        {part.location}
                      </td>
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
