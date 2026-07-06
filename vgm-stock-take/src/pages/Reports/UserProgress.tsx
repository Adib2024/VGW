import { useState, useEffect, useRef } from 'react';
import { Navigation } from '../../components/Navigation';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase, fetchAllRows } from '../../lib/supabase';
import { Download, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { BottomNav } from '../../components/ui/BottomNav';
import { getStatusColor, getStatusBadgeColors } from '../../lib/statusColor';


export default function UserProgress() {
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation title={t('userProgressReport') || 'User Progress Report'} backTo="/stock-take" />
      
      <main className="container flex-col gap-6" style={{ flex: 1, padding: '2rem 1rem 6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <Button onClick={handleDownloadCSV}>
            <Download size={18} /> {t('downloadCsv') || 'Download CSV'}
          </Button>
        </div>

        {/* User Summary Card */}
        <Card style={{ marginBottom: '1.5rem', padding: '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-color)' }}>{t('userSummary') || 'User Summary'}</h2>
            <div style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.5rem', borderRadius: '8px' }}>
              <UserIcon size={20} />
            </div>
          </div>
          <div style={{ padding: '1.5rem', backgroundColor: '#fff', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>{t('name') || 'Name'}:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{user?.name || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>{t('role')}:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{user?.role || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>{t('lastLogin') || 'Last Login'}:</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{lastLogin}</span>
                  {loginDevice !== '-' && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>via {loginDevice}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>{t('lastLogout') || 'Last Logout'}:</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{lastLogout}</span>
                  {logoutDevice !== '-' && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>via {logoutDevice}</span>}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div ref={reportRef} style={{ padding: '1rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              VGM CKD - Progress Summary
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: 'var(--surface-highlight)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--danger-color)' }}>
                  {parts.filter(p => p.status === 'Not Counted').length}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('notCounted')}</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-highlight)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning-color)' }}>
                  {parts.filter(p => p.status === 'Counted').length}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('counted')}</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-highlight)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success-color)' }}>
                  {parts.filter(p => p.status === 'Verified').length}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('verified')}</div>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div style={{ marginBottom: '2.5rem', backgroundColor: '#f1f5f9', borderRadius: '999px', height: '12px', width: '100%', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <div style={{ 
                height: '100%', 
                backgroundColor: 'var(--success-color)',
                width: `${parts.length ? (parts.filter(p => p.status === 'Verified').length / parts.length) * 100 : 0}%`,
                transition: 'width 0.5s ease-in-out'
              }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: '-2rem', marginBottom: '3rem', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
              <div style={{ fontSize: '1.25rem', color: '#0f172a', marginBottom: '0.5rem', fontWeight: 900 }}>Total Parts: {parts.length}</div>
              {parts.filter(p => p.status === 'Verified').length} {t('verified').toLowerCase()} ({parts.length ? Math.round((parts.filter(p => p.status === 'Verified').length / parts.length) * 100) : 0}%)
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>{t('filterByStatus') || 'Filter by Status'}</label>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                >
                  <option value="all">{t('allStatuses') || 'All Statuses'}</option>
                  <option value="Not Counted">{t('notCounted')}</option>
                  <option value="Counted">{t('counted')}</option>
                  <option value="Verified">{t('verified')}</option>
                </select>
              </div>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>{t('filterByLocation') || 'Filter by Location'}</label>
                <select 
                  value={locationFilter} 
                  onChange={(e) => setLocationFilter(e.target.value)}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                >
                  <option value="all">{t('allLocations') || 'All Locations'}</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            <h3 style={{ marginBottom: '1rem' }}>{t('recentActivity')}</h3>
            {loading ? (
              <p>{t('loadingData') || 'Loading data...'}</p>
            ) : (
              <div>
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredParts.map((p, index) => (
                      <div key={`${p.id}-${index}`} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: `6px solid ${getStatusColor(p.status)}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>{p.material || p.part_no || '-'}</span>
                          <span style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', backgroundColor: getStatusBadgeColors(p.status).bg, color: getStatusBadgeColors(p.status).text, fontSize: '0.75rem', fontWeight: 700 }}>
                            {p.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>{t('location') || 'Location'} / {t('zone') || 'Zone'}</span>
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem', textAlign: 'right' }}>{p.location || p.rack_number || p.storage_bin || '-'} ({p._table})</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>{t('verifiedBy') || 'Verified By'}</span>
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem', textAlign: 'right' }}>{p.verify_by || '-'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', paddingBottom: '0.5rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>Batch ID</span>
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem', textAlign: 'right' }}>{p.batch_id ? new Date(p.batch_id).toLocaleString() : '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredParts.length === 0 && (
                      <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>{t('noParts') || 'No activity found.'}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.875rem', minWidth: '600px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--surface-highlight)' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>{t('material') || 'Material'}</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>{t('location') || 'Location'} / {t('zone') || 'Zone'}</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>{t('status') || 'Status'}</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>{t('verifiedBy') || 'Verified By'}</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Batch ID (Date)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParts.map((p, index) => (
                          <tr key={`${p.id}-${index}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{p.material || p.part_no || '-'}</td>
                            <td style={{ padding: '0.75rem' }}>{p.location || p.rack_number || p.storage_bin || '-'} <span style={{fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase'}}>({p._table})</span></td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: getStatusBadgeColors(p.status).bg,
                                color: getStatusBadgeColors(p.status).text
                              }}>
                                {p.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem' }}>{p.verify_by || '-'}</td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                              {p.batch_id ? new Date(p.batch_id).toLocaleString() : '-'}
                            </td>
                          </tr>
                        ))}
                        {filteredParts.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>{t('noParts') || 'No activity found.'}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
              {t('showingLatestUpdates') || 'Showing latest updates. Generated on'} {new Date().toLocaleString()}.
          </div>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
