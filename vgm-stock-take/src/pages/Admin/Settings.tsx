import React, { useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { AdminTabs } from '../../components/AdminTabs';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { supabase } from '../../lib/supabase';
import { ZONE_THEME } from '../../lib/zoneTheme';
import { Upload, AlertTriangle, CheckCircle, Lock, Loader2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { BottomNav } from '../../components/ui/BottomNav';

const UPLOAD_ZONES = ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];

export default function AdminSettings() {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedZone, setSelectedZone] = useState('b17');
  // undefined = not checked yet
  const [zoneLocks, setZoneLocks] = useState<Record<string, boolean | undefined>>({});
  const [checkingLock, setCheckingLock] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const isMounted = React.useRef(true);

  const isLocked = !!zoneLocks[selectedZone];

  React.useEffect(() => {
    isMounted.current = true;
    UPLOAD_ZONES.forEach(zone => checkZoneLock(zone));
    return () => { isMounted.current = false; };
  }, []);

  const checkZoneLock = async (zone: string) => {
    if (zone === selectedZone) setCheckingLock(true);
    let locked = false;
    try {
      const { error } = await supabase.from(zone).select('id').limit(1);
      // If there is no error querying the table, the table EXISTS.
      // We lock it so the Admin must explicitly 'Unlock & Clear' (which Drops the table)
      // ensuring we never upload into a corrupted or outdated schema.
      locked = !error;
    } catch (err) {
      locked = false;
    } finally {
      if (isMounted.current) {
        setZoneLocks(prev => ({ ...prev, [zone]: locked }));
        if (zone === selectedZone) setCheckingLock(false);
      }
    }
  };

  const handleUnlockZone = () => {
    setShowUnlockModal(true);
  };

  const confirmUnlock = async () => {
    setShowUnlockModal(false);

    setCheckingLock(true);
    try {
      const { error } = await supabase.rpc('admin_drop_zone_table', { p_table_name: selectedZone });
      if (error) throw error;

      if (isMounted.current) {
        setZoneLocks(prev => ({ ...prev, [selectedZone]: false }));
        setMessage({ type: 'success', text: `Zone ${selectedZone.toUpperCase()} has been unlocked and cleared. You can now upload.` });
      }
    } catch (err: any) {
      if (isMounted.current) setMessage({ type: 'error', text: `Failed to unlock zone: ${err.message}` });
    } finally {
      if (isMounted.current) setCheckingLock(false);
    }
  };

  const addLog = (log: string) => {
    if (isMounted.current) setLogs(prev => [...prev, log]);
  };

  const sanitizeString = (str: string) => {
    return str
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, '') // Remove special characters
      .replace(/\s+/g, '_'); // Replace spaces with underscores
  };

  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone);
    setMessage({ type: '', text: '' }); // Clear message when changing zone
  };

  const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB - generous for a parts-list spreadsheet, blocks pathological files

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage({ type: 'error', text: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 15MB.` });
      e.target.value = '';
      return;
    }

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
        const XLSX = await import('xlsx');
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
        const SYSTEM_COLUMNS = ['id', 'batch_id', 'metadata', 'created_at'];
        const sanitizedHeaders = Array.from(rawHeaders).map((h, idx) => {
          let sanitized = sanitizeString(h || '');
          if (!sanitized) {
            sanitized = `unknown_col_${idx}`;
          }
          if (sanitized === 'csv_status') {
            sanitized = 'status';
          }
          if (SYSTEM_COLUMNS.includes(sanitized)) {
            sanitized = `csv_${sanitized}`;
          }
          return sanitized;
        });
        addLog(`Sanitized columns: ${sanitizedHeaders.join(', ')}`);

        // 1. Build the dynamic column list (fixed columns id/batch_id/status are
        // added server-side by the RPC - the sanitized CSV headers just need
        // to be re-validated there too, not trusted from this client sanitizer).
        addLog(`Generating schema for table '${targetTable}'...`);
        const dynamicColumns = sanitizedHeaders.filter(col => col !== 'status');

        // 2. Execute schema creation via RPC. The RPC itself checks the
        // caller is an Admin and applies fixed, safe RLS policies - it never
        // accepts raw SQL from the client.
        addLog(`Executing dynamic schema generation via RPC...`);
        const { error: rpcError } = await supabase.rpc('admin_create_zone_table', {
          p_table_name: targetTable,
          p_columns: dynamicColumns,
        });
        if (rpcError) {
          throw new Error(`RPC Execution Failed (did you run sql/001_auth_migration.sql?): ${rpcError.message}`);
        }
        addLog(`Successfully verified/created table schema '${targetTable}'. Waiting for schema cache to reload...`);

        // Wait 1.5 seconds to ensure PostgREST schema cache reloads before we insert
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (!isMounted.current) return;

        // 3. Transform Data rows
        const batchId = new Date().toISOString();
        const rows = rawData.slice(1);

        const transformedData = rows.map((row: any) => {
          const rowObj: any = {
            batch_id: batchId,
            status: 'Not Counted'
          };
          sanitizedHeaders.forEach((col, idx) => {
            const val = String(row[idx] ?? '').trim();
            if (col === 'status') {
              if (val) rowObj[col] = val;
            } else {
              rowObj[col] = val;
            }
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

        if (!isMounted.current) return;
        addLog(`Successfully ingested ${transformedData.length} records!`);
        setMessage({ type: 'success', text: `Upload complete! ${transformedData.length} parts added.` });
        // Lock it immediately after successful upload
        setZoneLocks(prev => ({ ...prev, [targetTable]: true, [selectedZone]: true }));
      } catch (err: any) {
        if (!isMounted.current) return;
        console.error(err);
        if (err.message?.includes('schema cache')) {
           setMessage({ type: 'error', text: `Supabase Cache Error: Still waiting for Supabase to refresh. Try clicking upload again in 5 seconds.` });
        } else {
           setMessage({ type: 'error', text: err.message || 'Error processing file. Ensure it has Material, PartNo, Location, Zone columns.' });
        }
      } finally {
        if (isMounted.current) setUploading(false);
        // Reset file input
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const selectedTheme = ZONE_THEME[selectedZone];
  const busy = uploading || checkingLock;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .as-step { display: flex; align-items: center; gap: 0.625rem; margin-top: 1.5rem; }
        .as-step b { width: 26px; height: 26px; border-radius: 50%; background: var(--primary-color); color: #fff; font-size: 0.8125rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .as-step h3 { margin: 0; font-size: 0.9375rem; }
        .as-zones { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin-top: 0.75rem; }
        @media (min-width: 600px) { .as-zones { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
        .as-zone {
          display: flex; flex-direction: column; gap: 0.25rem; padding: 0.75rem; min-height: 72px;
          border-radius: var(--radius-md); border: 1.5px solid var(--border-color); background: #FAF9F6;
          font-family: inherit; text-align: left; cursor: pointer; color: var(--text-primary);
        }
        .as-zone.on { border: 2px solid var(--primary-color); background: #fff; box-shadow: var(--shadow-md); }
        .as-zone .code { font-size: 1.25rem; font-weight: 900; font-stretch: 72%; line-height: 1.05; }
        .as-zone .meta { display: flex; align-items: center; gap: 4px; font-size: 0.6875rem; font-weight: 700; color: var(--text-secondary); }
        @media (max-width: 599px) { .as-zone.wide { grid-column: 1 / -1; } }
        .as-drop {
          margin-top: 0.75rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-align: center;
          padding: 1.5rem 1rem; border: 2px dashed #B9B5A9; border-radius: var(--radius-lg); background: #FAF9F6; cursor: pointer;
        }
        .as-drop:hover { border-color: var(--primary-color); }
        .as-drop.disabled { cursor: not-allowed; opacity: 0.6; }
        .as-log {
          margin-top: 1.25rem; padding: 1rem; background: var(--primary-color); border-radius: var(--radius-md);
          font-family: var(--font-mono); color: #9FE5C4; font-size: 0.75rem; line-height: 1.6;
          max-height: 220px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;
        }
      `}</style>

      <Navigation title={t('adminSettings')} backTo="/stock-take" />

      <main className="ds-page narrow with-nav" style={{ flex: 1 }}>
        <AdminTabs />

        <section className="ds-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t('masterPartsDbUpload')}</h2>
          <p style={{ margin: '0.375rem 0 0', fontSize: '0.875rem' }}>{t('uploadDesc')} A zone locks once it has data.</p>

          <div className="as-step"><b>1</b><h3>{t('assignZone').replace(/:$/, '')}</h3></div>
          <div className="as-zones" role="radiogroup" aria-label={t('assignZone')}>
            {UPLOAD_ZONES.map(zone => {
              const theme = ZONE_THEME[zone];
              const lock = zoneLocks[zone];
              return (
                <button
                  key={zone}
                  type="button"
                  role="radio"
                  aria-checked={selectedZone === zone}
                  className={`as-zone ${selectedZone === zone ? 'on' : ''} ${zone === 'check_part' ? 'wide' : ''}`}
                  onClick={() => handleZoneChange(zone)}
                  disabled={uploading}
                >
                  <span className="code" style={{ color: zone === 'check_part' ? 'var(--primary-color)' : theme.accent }}>{zone === 'check_part' ? 'Check Part' : theme.code}</span>
                  <span className="meta">
                    {lock === undefined ? '…' : lock ? <><Lock size={12} strokeWidth={2.5} /> Has data</> : <span style={{ color: 'var(--success-text)' }}>Empty · ready</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="as-step"><b>2</b><h3>Select file</h3></div>

          {isLocked ? (
            <div style={{ marginTop: '0.75rem', padding: '1.125rem', borderRadius: 'var(--radius-lg)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                <Lock size={18} /> {selectedTheme?.title} is locked
              </div>
              <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.8125rem', color: 'var(--danger-text)' }}>
                This zone already has a database table. To prevent schema errors and duplicate data, unlock and clear it before uploading a new master file.
              </p>
              <button type="button" className="ds-btn danger block" onClick={handleUnlockZone} disabled={checkingLock}>
                {checkingLock ? 'Unlocking...' : 'Unlock & clear zone'}
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="sr-only"
                id="excel-upload"
                disabled={busy}
              />
              <label htmlFor="excel-upload" className={`as-drop ${busy ? 'disabled' : ''}`}>
                <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                </span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 800 }}>
                  {uploading ? t('uploadingBtn') : checkingLock ? 'Checking zone status...' : t('selectUploadBtn')}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>.csv, .xlsx or .xls · max 15MB</span>
              </label>
            </>
          )}

          {message.text && (
            <div className={`ds-banner ${message.type === 'success' ? 'ok' : 'bad'}`} style={{ marginTop: '1rem' }}>
              {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
              <span>{message.text}</span>
            </div>
          )}

          <div style={{ marginTop: '1.125rem', padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{t('fileRequirements').replace(/:$/, '')}</div>
            <div>The table is generated from your file's column headers.</div>
            <div>Name the file with its zone (e.g. <code className="mono">VGM 2026 - B22.xlsx</code>) to route it automatically.</div>
          </div>

          {/* Parsing Integrity Log Container */}
          {logs.length > 0 && (
            <div className="as-log" aria-live="polite">
              <div style={{ color: '#fff', fontWeight: 700, marginBottom: '0.5rem' }}>Parsing integrity log</div>
              {logs.map((log, i) => (
                <div key={i}><span style={{ color: 'var(--text-on-dark)' }}>[{new Date().toLocaleTimeString()}]</span> {log}</div>
              ))}
            </div>
          )}
        </section>
      </main>

      <ConfirmDialog
        open={showUnlockModal}
        title="Confirm Unlock"
        message={<>Are you sure you want to unlock and <strong>CLEAR ALL DATA</strong> for Zone {selectedZone.toUpperCase()}? This action cannot be undone.</>}
        confirmLabel="Unlock Zone"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmUnlock}
        onCancel={() => setShowUnlockModal(false)}
      />
      <BottomNav />
    </div>
  );
}
