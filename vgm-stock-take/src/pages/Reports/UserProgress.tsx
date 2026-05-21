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
  const reportRef = useRef<HTMLDivElement>(null);

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
          .limit(100); // Limit to prevent massive fetching
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
                    {parts.slice(0, 50).map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
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
            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Showing latest 20 updates. Generated on {new Date().toLocaleString()}.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
