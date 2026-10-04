import React, { useState } from 'react';
import { errorMessage } from '../../lib/errors';
import { Navigation } from '../../components/Navigation';
import { AdminTabs } from '../../components/AdminTabs';
import { supabase, fetchRowsIfTableExists } from '../../lib/supabase';
import { ZONE_THEME } from '../../lib/zoneTheme';
import { Upload, AlertTriangle, CheckCircle, Lock, Loader2, FileSpreadsheet, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { BottomNav } from '../../components/ui/BottomNav';

const UPLOAD_ZONES = ['b17', 'b22', 'loma', 'b22_seq', 'check_part'];

// Location column each zone's List View reads (see StockTake/ListView.tsx).
const LOCATION_COLUMN: Record<string, string> = {
  b17: 'rack_number',
  b22: 'location',
  b22_seq: 'location',
  loma: 'storage_bin',
};

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB - generous for a parts-list spreadsheet, blocks pathological files
const SYSTEM_COLUMNS = ['id', 'batch_id', 'metadata', 'created_at'];

const zoneLabel = (zone: string) => (zone === 'check_part' ? 'Check Part' : ZONE_THEME[zone]?.code || zone.toUpperCase());

const sanitizeString = (str: string) => {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '') // Remove special characters
    .replace(/\s+/g, '_'); // Replace spaces with underscores
};

interface PendingUpload {
  fileName: string;
  detectedZone: string | null;
  target: string;
  headers: string[]; // sanitized
  rows: unknown[][];
}

export default function AdminSettings() {
  const { t, tf } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedZone, setSelectedZone] = useState('b17');
  // undefined = not checked yet
  const [zoneLocks, setZoneLocks] = useState<Record<string, boolean | undefined>>({});
  const [checkingLock, setCheckingLock] = useState(false);
  const [pending, setPending] = useState<PendingUpload | null>(null);

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockTyped, setUnlockTyped] = useState('');
  const [unlocking, setUnlocking] = useState(false);
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
    } catch {
      locked = false;
    } finally {
      if (isMounted.current) {
        setZoneLocks(prev => ({ ...prev, [zone]: locked }));
        if (zone === selectedZone) setCheckingLock(false);
      }
    }
  };

  // ---------- Unlock & clear (backup first) ----------

  const unlockCode = zoneLabel(selectedZone).toUpperCase();

  const openUnlock = () => {
    setUnlockTyped('');
    setShowUnlockModal(true);
  };

  const confirmUnlock = async () => {
    if (unlockTyped.trim().toUpperCase() !== unlockCode) return;
    setUnlocking(true);
    const zone = selectedZone;

    // 1. Back up everything in the zone. If this fails, nothing is deleted.
    let backupName = '';
    try {
      const rows = await fetchRowsIfTableExists(zone);
      if (rows && rows.length > 0) {
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(rows.map(r => {
          // metadata is JSON - flatten so it survives the round-trip to Excel
          const { metadata, ...rest } = r;
          return metadata && typeof metadata === 'object' ? { ...rest, metadata: JSON.stringify(metadata) } : rest;
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, zone);
        backupName = `VGM backup - ${zoneLabel(zone)} - ${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.xlsx`;
        XLSX.writeFile(wb, backupName);
      }
    } catch (err) {
      if (isMounted.current) {
        setUnlocking(false);
        setShowUnlockModal(false);
        setMessage({ type: 'error', text: tf('backupFailed', { err: errorMessage(err) || String(err) }) });
      }
      return;
    }

    // 2. Drop the table.
    setCheckingLock(true);
    try {
      const { error } = await supabase.rpc('admin_drop_zone_table', { p_table_name: zone });
      if (error) throw error;

      if (isMounted.current) {
        setZoneLocks(prev => ({ ...prev, [zone]: false }));
        setMessage({
          type: 'success',
          text: backupName
            ? tf('zoneCleared', { zone: zoneLabel(zone), file: backupName })
            : `Zone ${zoneLabel(zone)} has been unlocked and cleared. You can now upload.`,
        });
      }
    } catch (err) {
      if (isMounted.current) setMessage({ type: 'error', text: `Failed to unlock zone: ${errorMessage(err)}` });
    } finally {
      if (isMounted.current) {
        setCheckingLock(false);
        setUnlocking(false);
        setShowUnlockModal(false);
      }
    }
  };

  // ---------- Upload: read + preview, then confirm ----------

  const addLog = (log: string) => {
    if (isMounted.current) setLogs(prev => [...prev, log]);
  };

  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone);
    setMessage({ type: '', text: '' }); // Clear message when changing zone
    setPending(prev => (prev ? { ...prev, target: zone } : prev));
  };

  // Step 1: read the file and show what would be uploaded. Nothing is
  // written until the admin confirms in the preview.
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage({ type: 'error', text: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 15MB.` });
      return;
    }

    setMessage({ type: '', text: '' });
    setLogs([]);
    setParsing(true);

    // Suggest a zone from the filename, e.g. "VGM 2026 - B22.csv" -> "b22".
    // It's only a suggestion: a mismatch with the selected tile is shown in
    // the preview for the admin to resolve, never applied silently.
    const match = file.name.match(/(b17|b22[\s_]*seq|b22|loma|check[\s_]*part)/i);
    const detectedZone = match ? match[1].toLowerCase().replace(/\s+/g, '_') : null;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Read raw data with headers as array of arrays to extract exact headers
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
        if (rawData.length < 2) throw new Error('File is empty or missing data rows');

        const rawHeaders = rawData[0] as string[];
        // Sanitize headers, using Array.from to prevent sparse array skipping
        const headers = Array.from(rawHeaders).map((h, idx) => {
          let sanitized = sanitizeString(String(h ?? ''));
          if (!sanitized) sanitized = `unknown_col_${idx}`;
          if (sanitized === 'csv_status') sanitized = 'status';
          if (SYSTEM_COLUMNS.includes(sanitized)) sanitized = `csv_${sanitized}`;
          return sanitized;
        });

        const rows = rawData.slice(1).filter(r => Array.isArray(r) && r.some(v => String(v ?? '').trim() !== ''));

        if (isMounted.current) {
          setPending({ fileName: file.name, detectedZone, target: selectedZone, headers, rows });
        }
      } catch (err) {
        console.error(err);
        if (isMounted.current) setMessage({ type: 'error', text: errorMessage(err) || 'Could not read this file.' });
      } finally {
        if (isMounted.current) setParsing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Step 2: the confirmed upload (unchanged pipeline).
  const runUpload = async (p: PendingUpload) => {
    const targetTable = p.target;
    setUploading(true);
    setMessage({ type: '', text: '' });
    setLogs([]);
    addLog(`File: ${p.fileName}`);
    addLog(`Destination table: '${targetTable}'`);
    addLog(`Sanitized columns: ${p.headers.join(', ')}`);

    try {
      // 1. Build the dynamic column list (fixed columns id/batch_id/status are
      // added server-side by the RPC - the sanitized CSV headers just need
      // to be re-validated there too, not trusted from this client sanitizer).
      addLog(`Generating schema for table '${targetTable}'...`);
      const dynamicColumns = p.headers.filter(col => col !== 'status');

      // 2. Execute schema creation via RPC. The RPC itself checks the
      // caller is an Admin and applies fixed, safe RLS policies - it never
      // accepts raw SQL from the client.
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
      const transformedData = p.rows.map((row) => {
        const rowObj: Record<string, string> = {
          batch_id: batchId,
          status: 'Not Counted'
        };
        p.headers.forEach((col, idx) => {
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
      let lastInsertError: unknown = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { error: insertError } = await supabase.from(targetTable).upsert(transformedData);
          if (insertError) throw insertError;
          insertSuccess = true;
          break; // Success, exit retry loop
        } catch (err) {
          lastInsertError = err;
          if (errorMessage(err).includes('schema cache')) {
            addLog(`Schema cache not ready (attempt ${attempt}/3). Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw err; // Not a cache error, throw immediately
          }
        }
      }

      if (!insertSuccess) throw lastInsertError;

      if (!isMounted.current) return;
      addLog(`Successfully ingested ${transformedData.length} records!`);
      setMessage({ type: 'success', text: `Upload complete! ${transformedData.length} parts added to ${zoneLabel(targetTable)}.` });
      setZoneLocks(prev => ({ ...prev, [targetTable]: true })); // Lock it immediately after successful upload
      setPending(null);
    } catch (err) {
      if (!isMounted.current) return;
      console.error(err);
      if (errorMessage(err).includes('schema cache')) {
         setMessage({ type: 'error', text: `Supabase Cache Error: Still waiting for Supabase to refresh. Try clicking upload again in 5 seconds.` });
      } else {
         setMessage({ type: 'error', text: errorMessage(err) || 'Error processing file. Ensure it has Material, PartNo, Location, Zone columns.' });
      }
    } finally {
      if (isMounted.current) setUploading(false);
    }
  };

  // ---------- Preview checks ----------

  const previewChecks = (p: PendingUpload) => {
    const required = ['material', LOCATION_COLUMN[p.target]].filter(Boolean) as string[];
    const missingRequired = required.filter(c => !p.headers.includes(c));
    const hasBoxes = p.headers.some(h => /box/i.test(h));
    const hasRecount = p.headers.some(h => /recount/i.test(h));
    return { missingRequired, hasBoxes, hasRecount };
  };

  const prettyCol = (c: string) => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const selectedTheme = ZONE_THEME[selectedZone];
  const busy = uploading || checkingLock || parsing;

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
        .as-preview { margin-top: 0.75rem; border: 2px solid var(--primary-color); border-radius: var(--radius-lg); padding: 1rem; }
        .as-cols { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 0.5rem; }
        .as-cols span { font-family: var(--font-mono); font-size: 0.6875rem; font-weight: 600; padding: 3px 7px; border-radius: 6px; background: var(--surface-highlight); }
        .as-choice { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin-top: 0.625rem; }
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
          <p style={{ margin: '0.375rem 0 0', fontSize: '0.875rem' }}>{t('uploadDesc')} {t('zoneLocksNote')}</p>

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
                  <span className="code" style={{ color: zone === 'check_part' ? 'var(--primary-color)' : theme.accent }}>{zoneLabel(zone)}</span>
                  <span className="meta">
                    {lock === undefined ? '…' : lock ? <><Lock size={12} strokeWidth={2.5} /> {t('hasData')}</> : <span style={{ color: 'var(--success-text)' }}>{t('emptyReady')}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="as-step"><b>2</b><h3>{t('selectFile')}</h3></div>

          {isLocked && !pending ? (
            <div style={{ marginTop: '0.75rem', padding: '1.125rem', borderRadius: 'var(--radius-lg)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                <Lock size={18} /> {tf('zoneIsLocked', { zone: selectedTheme?.title || zoneLabel(selectedZone) })}
              </div>
              <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.8125rem', color: 'var(--danger-text)' }}>
                {t('lockedExplain')}
              </p>
              <button type="button" className="ds-btn danger block" onClick={openUnlock} disabled={checkingLock}>
                {t('unlockClear')}
              </button>
            </div>
          ) : pending ? (
            (() => {
              const { missingRequired, hasBoxes, hasRecount } = previewChecks(pending);
              const mismatch = pending.detectedZone && pending.detectedZone !== selectedZone && UPLOAD_ZONES.includes(pending.detectedZone);
              const targetLocked = !!zoneLocks[pending.target];
              return (
                <div className="as-preview">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FileSpreadsheet size={22} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="eyebrow">{t('previewTitle')}</div>
                      <div className="mono" style={{ fontSize: '0.8125rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pending.fileName}</div>
                    </div>
                    <button type="button" className="ds-iconbtn ghost" aria-label={t('chooseOtherFile')} onClick={() => setPending(null)} disabled={uploading}>
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <span className="ds-chip" style={{ background: 'var(--primary-color)', color: '#fff' }}>→ {zoneLabel(pending.target)}</span>
                    <span className="ds-chip mono">{tf('rowsFound', { n: pending.rows.length.toLocaleString() })}</span>
                  </div>

                  {mismatch && (
                    <div style={{ marginTop: '0.875rem' }}>
                      <div className="ds-banner" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
                        <AlertTriangle size={18} />
                        <span>{tf('zoneMismatch', { fileZone: zoneLabel(pending.detectedZone!), selZone: zoneLabel(selectedZone) })}</span>
                      </div>
                      <div className="as-choice">
                        {[selectedZone, pending.detectedZone!].map(z => (
                          <button
                            key={z}
                            type="button"
                            className={`ds-btn sm ${pending.target === z ? 'ink' : 'outline'}`}
                            aria-pressed={pending.target === z}
                            onClick={() => setPending({ ...pending, target: z })}
                          >
                            {zoneLabel(z)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '0.875rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('columnsFound')}</div>
                  <div className="as-cols">
                    {pending.headers.map((h, i) => <span key={`${h}-${i}`}>{h}</span>)}
                  </div>

                  {(missingRequired.length > 0 || !hasBoxes || !hasRecount) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.875rem' }}>
                      {missingRequired.length > 0 && (
                        <div className="ds-banner bad"><AlertTriangle size={16} /><span>{tf('missingRequired', { cols: missingRequired.map(prettyCol).join(', ') })}</span></div>
                      )}
                      {!hasBoxes && (
                        <div className="ds-banner bad"><AlertTriangle size={16} /><span>{t('missingBoxes')}</span></div>
                      )}
                      {!hasRecount && (
                        <div className="ds-banner" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}><AlertTriangle size={16} /><span>{t('missingRecount')}</span></div>
                      )}
                    </div>
                  )}

                  {targetLocked && (
                    <div className="ds-banner bad" style={{ marginTop: '0.875rem' }}>
                      <Lock size={16} /><span>{tf('targetLocked', { zone: zoneLabel(pending.target) })}</span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '0.5rem', marginTop: '1rem' }}>
                    <button type="button" className="ds-btn quiet" onClick={() => setPending(null)} disabled={uploading}>
                      {t('cancel')}
                    </button>
                    <button type="button" className="ds-btn signal" onClick={() => runUpload(pending)} disabled={uploading || targetLocked}>
                      {uploading ? <><Loader2 size={18} className="animate-spin" /> {t('uploadingBtn')}</> : tf('uploadTo', { zone: zoneLabel(pending.target) })}
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileSelect}
                className="sr-only"
                id="excel-upload"
                disabled={busy}
              />
              <label htmlFor="excel-upload" className={`as-drop ${busy ? 'disabled' : ''}`}>
                <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {parsing ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                </span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 800 }}>
                  {parsing ? t('readingFile') : checkingLock ? t('checkingZone') : t('selectUploadBtn')}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('fileTypesHint')}</span>
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
            <div>{t('fileTableNote')}</div>
            <div>{t('fileNameNote')}</div>
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

      {showUnlockModal && (
        <div className="ds-overlay" role="dialog" aria-modal="true" aria-labelledby="unlock-title">
          <div className="ds-modal">
            <h3 id="unlock-title" style={{ color: 'var(--danger-color)' }}>{tf('unlockTitle', { zone: zoneLabel(selectedZone) })}</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.9375rem' }}>{tf('unlockWarn', { zone: zoneLabel(selectedZone) })}</p>
            <label htmlFor="unlock-confirm" className="ds-label">{tf('typeToConfirm', { code: unlockCode })}</label>
            <input
              id="unlock-confirm"
              className="ds-fld mono"
              value={unlockTyped}
              onChange={(e) => setUnlockTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder={unlockCode}
              disabled={unlocking}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.625rem', marginTop: '1.25rem' }}>
              <button type="button" className="ds-btn quiet" onClick={() => setShowUnlockModal(false)} disabled={unlocking}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ds-btn danger"
                onClick={confirmUnlock}
                disabled={unlocking || unlockTyped.trim().toUpperCase() !== unlockCode}
              >
                {unlocking ? t('backingUp') : t('backupAndClear')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
