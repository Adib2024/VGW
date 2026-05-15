import React, { useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminSettings() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage({ type: '', text: '' });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) throw new Error('File is empty');

        // Transform data to match parts table schema
        // Expected columns in excel: Material, PartNo, Location, Zone
        const transformedData = data.map((row: any) => ({
          material: row.Material || row.material || 'Unknown',
          part_no: row.PartNo || row.part_no || row['Part No'] || 'Unknown',
          location: row.Location || row.location || 'Unknown',
          zone: row.Zone || row.zone || 'B17',
          status: 'Not Counted'
        }));

        // Insert into Supabase
        const { error } = await supabase.from('parts').insert(transformedData);
        
        if (error) throw error;

        setMessage({ type: 'success', text: `Successfully uploaded ${transformedData.length} parts.` });
      } catch (err: any) {
        console.error(err);
        setMessage({ type: 'error', text: err.message || 'Error processing file. Ensure it has Material, PartNo, Location, Zone columns.' });
      } finally {
        setUploading(false);
        // Reset file input
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation title="Admin Settings" backTo="/stock-take" />
      
      <main className="container flex-col gap-6" style={{ flex: 1, padding: '2rem 1rem', maxWidth: '800px' }}>
        
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: '50%', color: 'var(--primary-color)' }}>
              <Upload size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0 }}>Master Parts Database Upload</h2>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Upload a .xlsx file to refresh the parts inventory.</p>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--surface-highlight)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>File Requirements:</h3>
            <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>Format: <strong>.xlsx</strong> or <strong>.xls</strong></li>
              <li>Columns: <strong>Material</strong>, <strong>PartNo</strong>, <strong>Location</strong>, <strong>Zone</strong></li>
              <li>Valid Zones: <strong>B17</strong>, <strong>B22</strong>, <strong>LOMA</strong>, <strong>B22 SEQ</strong></li>
            </ul>
          </div>

          {message.text && (
            <div style={{ 
              padding: '1rem', 
              borderRadius: 'var(--radius-md)', 
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: message.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)',
              border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
            }}>
              {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              {message.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="excel-upload"
              disabled={uploading}
            />
            <label htmlFor="excel-upload">
              <Button as="span" style={{ pointerEvents: 'none' }} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Select & Upload Excel File'}
              </Button>
            </label>
          </div>
        </Card>
        
      </main>
    </div>
  );
}
