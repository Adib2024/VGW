import React, { useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../contexts/LanguageContext';

export default function AdminSettings() {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedZone, setSelectedZone] = useState('b17');

  const addLog = (log: string) => {
    setLogs(prev => [...prev, log]);
  };

  const sanitizeString = (str: string) => {
    return str
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, '') // Remove special characters
      .replace(/\s+/g, '_'); // Replace spaces with underscores
  };

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedZone(e.target.value);
    setMessage({ type: '', text: '' }); // Clear message when changing zone
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage({ type: '', text: '' });
    setLogs([]);
    
    addLog(`File selected: ${file.name}`);

    // Auto-detect table from filename
    // e.g. "VGM 2026 - B22.csv" -> "b22"
    let targetTable = selectedZone;
    const match = file.name.match(/(b17|b22[\s_]*seq|b22|loma|check[\s_]*part)/i);
    if (match) {
      targetTable = match[1].toLowerCase().replace(/\s+/g, '_');
      addLog(`Auto-detected destination table: '${targetTable}'`);
    } else {
      addLog(`Could not auto-detect from filename. Using selected: '${targetTable}'`);
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Read raw data with headers as array of arrays to extract exact headers
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rawData.length < 2) throw new Error('File is empty or missing data rows');
        
        const rawHeaders = rawData[0] as string[];
        addLog(`Extracted ${rawHeaders.length} headers from CSV...`);
        
        // Sanitize headers, using Array.from to prevent sparse array skipping
        const SYSTEM_COLUMNS = ['id', 'batch_id', 'status', 'metadata', 'created_at'];
        const sanitizedHeaders = Array.from(rawHeaders).map((h, idx) => {
          let sanitized = sanitizeString(h || '');
          if (!sanitized) {
            sanitized = `unknown_col_${idx}`;
          }
          if (SYSTEM_COLUMNS.includes(sanitized)) {
            sanitized = `csv_${sanitized}`;
          }
          return sanitized;
        });
        addLog(`Sanitized columns: ${sanitizedHeaders.join(', ')}`);
        
        // 1. Generate DDL for dynamic schema
        addLog(`Generating DDL for table '${targetTable}'...`);
        const columnDefinitions = sanitizedHeaders.map(col => `"${col}" TEXT`).join(', ');
        
        const ddlString = `
          CREATE TABLE IF NOT EXISTS "${targetTable}" (
            id BIGSERIAL PRIMARY KEY,
            batch_id TEXT,
            status TEXT DEFAULT 'Not Counted',
            ${columnDefinitions}
          );
          
          ALTER TABLE "${targetTable}" ENABLE ROW LEVEL SECURITY;
          DROP POLICY IF EXISTS "Enable read access for all users" ON "${targetTable}";
          CREATE POLICY "Enable read access for all users" ON "${targetTable}" FOR SELECT USING (true);
          DROP POLICY IF EXISTS "Enable insert for all users" ON "${targetTable}";
          CREATE POLICY "Enable insert for all users" ON "${targetTable}" FOR INSERT WITH CHECK (true);
          DROP POLICY IF EXISTS "Enable update for all users" ON "${targetTable}";
          CREATE POLICY "Enable update for all users" ON "${targetTable}" FOR UPDATE USING (true);
        `;

        // 2. Execute DDL via RPC
        addLog(`Executing dynamic schema generation via RPC...`);
        const { error: rpcError } = await supabase.rpc('create_dynamic_table', { query: ddlString });
        if (rpcError) {
          throw new Error(`RPC Execution Failed (Did you run the setup_rpc.sql?): ${rpcError.message}`);
        }
        addLog(`Successfully verified/created table schema '${targetTable}'. Waiting for schema cache to reload...`);
        
        // Wait 1.5 seconds to ensure PostgREST schema cache reloads before we insert
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 3. Transform Data rows
        const batchId = new Date().toISOString();
        const rows = rawData.slice(1);
        
        const transformedData = rows.map((row: any) => {
          const rowObj: any = { 
            batch_id: batchId,
            status: 'Not Counted'
          };
          sanitizedHeaders.forEach((col, idx) => {
            rowObj[col] = String(row[idx] ?? '');
          });
          return rowObj;
        });

        // 4. Bulk Upsert with Retry Mechanism for Schema Cache
        addLog(`Streaming ${transformedData.length} records into Supabase...`);
        
        let insertSuccess = false;
        let lastInsertError: any = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const { error: insertError } = await supabase.from(targetTable).upsert(transformedData);
            if (insertError) throw insertError;
            
            insertSuccess = true;
            break; // Success, exit retry loop
          } catch (err: any) {
            lastInsertError = err;
            if (err.message?.includes('schema cache')) {
              addLog(`Schema cache not ready (attempt ${attempt}/3). Retrying in 2 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              throw err; // Not a cache error, throw immediately
            }
          }
        }
        
        if (!insertSuccess) {
          throw lastInsertError;
        }

        addLog(`Successfully ingested ${transformedData.length} records!`);
        setMessage({ type: 'success', text: `Upload complete! ${transformedData.length} parts added.` });
      } catch (err: any) {
        console.error(err);
        if (err.message?.includes('schema cache')) {
           setMessage({ type: 'error', text: `Supabase Cache Error: Still waiting for Supabase to refresh. Try clicking upload again in 5 seconds.` });
        } else {
           setMessage({ type: 'error', text: err.message || 'Error processing file. Ensure it has Material, PartNo, Location, Zone columns.' });
        }
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
      <Navigation title={t('adminSettings')} backTo="/stock-take" />
      
      <main className="container flex-col gap-6" style={{ flex: 1, padding: '2rem 1rem', maxWidth: '800px' }}>
        
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: '50%', color: 'var(--primary-color)' }}>
              <Upload size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{t('masterPartsDbUpload')}</h2>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>{t('uploadDesc')}</p>
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(241, 245, 249, 0.8)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(226, 232, 240, 0.8)', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#1e293b', fontWeight: 600 }}>{t('fileRequirements')}</h3>
            <ul style={{ paddingLeft: '1.5rem', color: '#475569', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong>Format:</strong> .csv, .xlsx, or .xls</li>
              <li><strong>Dynamic Tables:</strong> The database table will be auto-generated based strictly on the column headers in your file.</li>
              <li><strong>Auto-Detection:</strong> Name your file with the zone (e.g. <code>VGM 2026 - B22.csv</code>) to automatically route it!</li>
            </ul>
          </div>

          <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>{t('assignZone')}</label>
            <select 
              value={selectedZone} 
              onChange={handleZoneChange}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#334155',
                outline: 'none',
                width: '100%',
                maxWidth: '400px',
                fontSize: '1rem',
                fontWeight: 500,
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'; }}
            >
              <option value="b17">Zone B17</option>
              <option value="b22">Zone B22</option>
              <option value="loma">Zone LOMA</option>
              <option value="b22_seq">Zone B22 SEQ</option>
              <option value="check_part">Check Part</option>
            </select>
          </div>

          {message.text && (
            <div style={{ 
              padding: '1rem 1.25rem', 
              borderRadius: '8px', 
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
              border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              fontWeight: 500,
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}>
              {message.type === 'success' ? <CheckCircle size={20} color="#22c55e" /> : <AlertTriangle size={20} color="#ef4444" />}
              {message.text}
            </div>
          )}

          <div style={{ display: 'flex' }}>
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="excel-upload"
              disabled={uploading}
            />
            <label htmlFor="excel-upload" style={{ width: '100%', cursor: 'pointer' }}>
              <Button as="span" style={{ pointerEvents: 'none', width: '100%', display: 'flex', justifyContent: 'center', padding: '1rem', fontSize: '1.05rem', fontWeight: 600, backgroundColor: '#001e50', color: '#ffffff', borderRadius: '8px', transition: 'background-color 0.2s', opacity: uploading ? 0.7 : 1 }} disabled={uploading}>
                {uploading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '1rem', height: '1rem', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    {t('uploadingBtn')}
                  </span>
                ) : (
                  t('selectUploadBtn')
                )}
              </Button>
            </label>
          </div>

          {/* Parsing Integrity Log Container */}
          {logs.length > 0 && (
            <div style={{
              marginTop: '2rem',
              padding: '1.5rem',
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              fontFamily: 'monospace',
              color: '#38bdf8',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              maxHeight: '200px',
              overflowY: 'auto',
              boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.2)'
            }}>
              <h4 style={{ color: '#fff', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>Parsing Integrity Verification Log</h4>
              {logs.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>[{new Date().toLocaleTimeString()}]</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}

        </Card>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    </div>
  );
}
