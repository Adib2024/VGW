import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '../../components/Navigation';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { Search } from 'lucide-react';

export default function StockTakeListView() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [parts, setParts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParts();
    
    const channel = supabase
      .channel('parts-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, () => {
        fetchParts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('part_no', { ascending: true });
        
      if (error) throw error;
      setParts(data || []);
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
        <Card>
          <div style={{ marginBottom: '1.5rem' }}>
            <Input 
              icon={<Search size={18} />}
              placeholder={t('search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <p style={{ textAlign: 'center', padding: '2rem' }}>Loading parts...</p>
            ) : (
              <table style={{ width: '100%', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Part No</th>
                    <th>Zone</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParts.map(part => (
                    <tr key={part.id} className="hover:bg-slate-800/50 transition-colors">
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{part.material}</td>
                      <td>{part.part_no}</td>
                      <td>{part.zone}</td>
                      <td>{part.location}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span className={getStatusDot(part.status)}></span>
                          {getStatusText(part.status)}
                        </div>
                      </td>
                      <td>
                        <button 
                          onClick={() => navigate(`/stock-take/count/${part.id}`)}
                          style={{
                            backgroundColor: 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 500
                          }}
                        >
                          View / Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredParts.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No parts found.</td>
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
