import { useState, useEffect, useRef } from 'react';
import { Navigation } from '../../components/Navigation';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function UserProgress() {
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const tables = ['b17', 'b22', 'b22_seq', 'loma', 'check_part'];
      let allParts: any[] = [];
      
      for (const t of tables) {
        const { data } = await supabase
          .from(t)
          .select('*')
          .select('*');
        if (data) allParts = [...allParts, ...data.map(d => ({ ...d, _table: t }))];
      }
      
      // Sort by status instead since last_updated does not exist
      setParts(allParts.sort((a, b) => {
        const order = { 'Verified': 1, 'Counted': 2, 'Not Counted': 3 };
        return (order[a.status as keyof typeof order] || 4) - (order[b.status as keyof typeof order] || 4);
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('VGM_StockTake_Report.pdf');
    } catch (err) {
      console.error('Failed to generate PDF', err);
      alert('Failed to generate PDF');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation title="User Progress Report" backTo="/stock-take" />
      
      <main className="container flex-col gap-6" style={{ flex: 1, padding: '2rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <Button onClick={handleDownloadPDF}>
            <Download size={18} /> Download PDF
          </Button>
        </div>

        <Card>
          <div ref={reportRef} style={{ padding: '1rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              VGM Stock Take - Progress Summary
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: 'var(--surface-highlight)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--danger-color)' }}>
                  {parts.filter(p => p.status === 'Not Counted').length}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>Not Counted</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-highlight)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning-color)' }}>
                  {parts.filter(p => p.status === 'Counted').length}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>Counted</div>
              </div>
              <div style={{ backgroundColor: 'var(--surface-highlight)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success-color)' }}>
                  {parts.filter(p => p.status === 'Verified').length}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>Verified</div>
              </div>
            </div>

            <h3 style={{ marginBottom: '1rem' }}>Recent Activity</h3>
            {loading ? (
              <p>Loading data...</p>
            ) : (
              <div>
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {parts.map((p, index) => (
                      <div key={`${p.id}-${index}`} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: `6px solid ${p.status === 'Verified' ? '#2ecc71' : p.status === 'Counted' ? '#f39c12' : '#e74c3c'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>{p.material || p.part_no || '-'}</span>
                          <span style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', backgroundColor: p.status === 'Verified' ? '#dcfce7' : p.status === 'Counted' ? '#fef3c7' : '#fee2e2', color: p.status === 'Verified' ? '#166534' : p.status === 'Counted' ? '#92400e' : '#991b1b', fontSize: '0.75rem', fontWeight: 700 }}>
                            {p.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>Location / Zone</span>
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem' }}>{p.location || p.rack_number || p.storage_bin || '-'} ({p._table})</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f8fafc', paddingBottom: '0.5rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>Verified By</span>
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem' }}>{p.verify_by || '-'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>Batch ID</span>
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.875rem' }}>{p.batch_id ? new Date(p.batch_id).toLocaleString() : '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {parts.length === 0 && (
                      <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No activity found.</p>
                    )}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.875rem', minWidth: '600px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--surface-highlight)' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Material</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Location / Zone</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Verified By</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Batch ID (Date)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parts.map((p, index) => (
                          <tr key={`${p.id}-${index}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{p.material || p.part_no || '-'}</td>
                            <td style={{ padding: '0.75rem' }}>{p.location || p.rack_number || p.storage_bin || '-'} <span style={{fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase'}}>({p._table})</span></td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: p.status === 'Verified' ? '#dcfce7' : p.status === 'Counted' ? '#fef3c7' : '#fee2e2',
                                color: p.status === 'Verified' ? '#166534' : p.status === 'Counted' ? '#92400e' : '#991b1b'
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
                        {parts.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>No activity found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
              Generated on {new Date().toLocaleString()}.
          </div>
        </Card>
      </main>
    </div>
  );
}
