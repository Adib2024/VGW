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
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('last_updated', { ascending: false });
        
      if (error) throw error;
      setParts(data || []);
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
              <table style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Material</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Part Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Location</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.slice(0, 20).map(part => (
                    <tr key={part.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem' }}>{part.material}</td>
                      <td style={{ padding: '0.75rem' }}>{part.part_name || '-'}</td>
                      <td style={{ padding: '0.75rem' }}>{part.location}</td>
                      <td style={{ padding: '0.75rem', 
                        color: part.status === 'Verified' ? 'var(--success-color)' : 
                               part.status === 'Counted' ? 'var(--warning-color)' : 'var(--danger-color)'
                      }}>
                        {part.status}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                        {part.last_updated ? new Date(part.last_updated).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
