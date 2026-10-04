import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Navigation } from '../../components/Navigation';
import { Camera, X, Keyboard, History } from 'lucide-react';
import type { Html5QrcodeScanner } from 'html5-qrcode';

const STATUSES = [
  { value: 'Scanned', label: 'Scanned', hint: 'Awaiting action' },
  { value: 'Charged', label: 'Charged', hint: '' },
  { value: 'Deployed', label: 'Deployed', hint: '' },
  { value: 'Faulty', label: 'Faulty / Return', hint: '' },
];

const STATUS_CHIP: Record<string, [string, string]> = {
  Scanned: ['#F1EFE9', '#4A5468'],
  Charged: ['#DDF3EA', '#075E42'],
  Deployed: ['#E5ECFF', '#1F3A8A'],
  Faulty: ['#FDE4E8', '#8C1328'],
};

// Malaysia has no DST, so a fixed UTC+8 offset gives the right "today".
function startOfTodayMalaysiaISO(): string {
  const nowMY = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const startMY = Date.UTC(nowMY.getUTCFullYear(), nowMY.getUTCMonth(), nowMY.getUTCDate());
  return new Date(startMY - 8 * 60 * 60 * 1000).toISOString();
}

interface ScanRow {
  battery_serial_number: string;
  status: string | null;
  at: string;
  scanned_by?: string | null;
  location_id?: string | null;
}

const LOG_COLUMNS = 'battery_serial_number, status, scanned_at, scanned_by, location_id';
type LogRow = Omit<ScanRow, 'at'> & { scanned_at: string };
const fromLog = (r: LogRow): ScanRow => ({ ...r, at: r.scanned_at });

export default function Tracker() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [serialNumber, setSerialNumber] = useState('');
  const [locationId, setLocationId] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [status, setStatus] = useState('Scanned');
  const [isManual, setIsManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [recent, setRecent] = useState<ScanRow[]>([]);
  const [history, setHistory] = useState<ScanRow[]>([]);
  const [showScans, setShowScans] = useState(false);
  // Whether battery_scan_log exists (sql/009_battery_scan_log.sql). null = not known yet.
  const logAvailable = useRef<boolean | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const fetchToday = async () => {
    const since = startOfTodayMalaysiaISO();
    const { count } = await supabase.from('battery_tracking').select('id', { count: 'exact', head: true }).gte('created_at', since);
    setTodayCount(count ?? 0);

    // Every scan from the history log; before that migration is run, fall
    // back to each battery's latest state.
    if (logAvailable.current !== false) {
      const { data, error } = await supabase.from('battery_scan_log').select(LOG_COLUMNS)
        .gte('scanned_at', since).order('scanned_at', { ascending: false }).limit(5);
      if (!error) {
        logAvailable.current = true;
        setRecent(((data as LogRow[]) || []).map(fromLog));
        return;
      }
      if (error.code === 'PGRST205') logAvailable.current = false;
    }
    const { data } = await supabase.from('battery_tracking').select('battery_serial_number, status, created_at')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(5);
    setRecent(((data as { battery_serial_number: string; status: string; created_at: string }[]) || [])
      .map(r => ({ battery_serial_number: r.battery_serial_number, status: r.status, at: r.created_at })));
  };

  useEffect(() => { fetchToday(); }, []);

  // Earlier scans of the battery currently in the form.
  useEffect(() => {
    const serial = serialNumber.trim();
    if (serial.length < 3 || logAvailable.current === false) {
      setHistory([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.from('battery_scan_log').select(LOG_COLUMNS)
        .eq('battery_serial_number', serial).order('scanned_at', { ascending: false }).limit(5);
      if (error?.code === 'PGRST205') logAvailable.current = false;
      setHistory(error ? [] : ((data as LogRow[]) || []).map(fromLog));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [serialNumber]);

  // Append-only history row. Best-effort: a failure here (or the table not
  // existing yet) must never block the main save, which already succeeded.
  const logScan = async (serial: string) => {
    if (logAvailable.current === false) return;
    const { error } = await supabase.from('battery_scan_log').insert({
      battery_serial_number: serial,
      status,
      location_id: locationId || null,
      part_number: partNumber || null,
      scanned_by: user?.id,
    });
    if (error) {
      if (error.code === 'PGRST205') logAvailable.current = false;
      console.warn('battery_scan_log insert failed:', error.message);
    }
  };

  const startScanner = async () => {
    setScanning(true);
    const { Html5QrcodeScanner, Html5QrcodeScanType } = await import('html5-qrcode');
    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          videoConstraints: {
            facingMode: "environment"
          }
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          setSerialNumber(decodedText.trim());
          setScanning(false);
          if (scannerRef.current) {
            scannerRef.current.clear();
          }
        },
        () => {
          // ignore continuous scan errors to prevent console spam
        }
      );
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setScanning(false);
  };

  // Ensure camera shuts down if component unmounts while scanning
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, []);

  const handleSave = async () => {
    const trimmedSerial = serialNumber.trim();
    if (!trimmedSerial) {
      addToast('Please scan or enter a serial number', 'error');
      return;
    }

    setSaving(true);
    try {
      // Check if exists. PGRST116 = no matching row, the expected/normal case
      // for a brand-new serial - any other error means we don't actually know
      // whether a row exists, so we must not fall through to insert (that risks
      // creating a duplicate row for a battery that already has one).
      const { data: existing, error: lookupError } = await supabase
        .from('battery_tracking')
        .select('id')
        .eq('battery_serial_number', trimmedSerial)
        .single();

      if (lookupError && lookupError.code !== 'PGRST116') {
        addToast('Could not verify existing record. Please try again.', 'error');
        return;
      }

      if (existing) {
        // Update
        const { error } = await supabase
          .from('battery_tracking')
          .update({
            location_id: locationId,
            part_number: partNumber,
            status,
            scanned_by: user?.id,
            created_at: new Date().toISOString() // update timestamp to track latest scan
          })
          .eq('battery_serial_number', trimmedSerial);

        if (error) {
          addToast('Error updating battery record', 'error');
        } else {
          addToast('Battery record updated successfully!', 'success');
          await logScan(trimmedSerial);
          resetForm();
          fetchToday();
        }
      } else {
        // Insert
        const { error } = await supabase
          .from('battery_tracking')
          .insert({
            battery_serial_number: trimmedSerial,
            part_number: partNumber,
            location_id: locationId,
            status,
            scanned_by: user?.id
          });

        if (error) {
          addToast('Error saving battery', 'error');
        } else {
          addToast('Battery saved successfully!', 'success');
          await logScan(trimmedSerial);
          resetForm();
          fetchToday();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSerialNumber('');
    setLocationId('');
    setPartNumber('');
    setIsManual(false);
    setStatus('Scanned');
  };

  const fmtTime = (iso: string, withDate = false) =>
    new Date(iso).toLocaleString('en-GB', {
      ...(withDate ? { day: '2-digit', month: 'short' } : {}),
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
    });

  const renderScanRow = (r: ScanRow, withDate: boolean) => {
    const [bg, fg] = STATUS_CHIP[r.status ?? ''] || STATUS_CHIP.Scanned;
    return (
      <li key={`${r.battery_serial_number}-${r.at}`}>
        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: withDate ? 96 : 44 }}>{fmtTime(r.at, withDate)}</span>
        <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {withDate ? [r.location_id, r.scanned_by].filter(Boolean).join(' · ') || '—' : r.battery_serial_number}
        </span>
        <span className="ds-chip" style={{ background: bg, color: fg, height: 22, fontSize: '0.625rem' }}>{r.status}</span>
      </li>
    );
  };

  const lastScan = history[0];

  return (
    <div className="screen-fit">
    <div className="screen-col">
      <style>{`
        .bt-main {
          flex: 1; display: flex; flex-direction: column; gap: 0.625rem;
          padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
        }
        /* The viewfinder takes whatever height the form leaves, so the whole
           page fits one screen. While the camera runs it needs real room. */
        .bt-scan {
          position: relative; overflow: hidden; flex: 1 1 140px; min-height: 108px; max-height: 300px; margin-top: 0.25rem;
          border-radius: var(--radius-panel); background: var(--primary-color); color: #fff;
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
        }
        .bt-scan.idle { cursor: pointer; }
        .bt-scan.live { flex-basis: 320px; min-height: 300px; max-height: none; }
        .bt-scan .grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .bt-frame { position: absolute; left: 20%; right: 20%; top: 14%; bottom: 40%; }
        .bt-corner { position: absolute; width: 26px; height: 26px; border: 0 solid #3DDC97; }
        .bt-line { position: absolute; left: 0; right: 0; top: 50%; height: 2px; background: #3DDC97; box-shadow: 0 0 14px 2px rgba(61,220,151,0.6); animation: bt-sweep 2.4s ease-in-out infinite alternate; }
        @keyframes bt-sweep { from { top: 10%; } to { top: 90%; } }
        @media (prefers-reduced-motion: reduce) { .bt-line { animation: none; } }
        .bt-live { position: absolute; inset: 0; background: #000; }
        .bt-live #reader { width: 100%; height: 100%; border: 0 !important; }
        .bt-card { padding: 0.875rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; flex-shrink: 0; }
        .bt-card .ds-fld { height: 46px; }
        .bt-card .ds-label { margin-bottom: 3px; }
        .bt-status { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.375rem; }
        .bt-opt {
          display: flex; align-items: center; gap: 0.5rem; min-height: 44px; padding: 0 0.75rem;
          border-radius: var(--radius-md); border: 1.5px solid var(--border-color); background: #FAF9F6;
          font-size: 0.8125rem; font-weight: 700; cursor: pointer;
        }
        .bt-opt input { width: 18px; height: 18px; margin: 0; accent-color: #0B7A55; }
        .bt-opt.on { border: 2px solid #0B7A55; background: var(--success-bg); }
        .bt-serial { height: 46px; display: flex; align-items: center; padding: 0 1rem; border-radius: var(--radius-md); font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .bt-serial.has { border: 1.5px solid #0B7A55; background: var(--success-bg); color: var(--success-text); }
        .bt-serial.empty { border: 1.5px dashed #8A8F99; background: #FAF9F6; color: var(--text-secondary); font-family: var(--font-body); font-weight: 600; }
        .bt-last { display: flex; align-items: center; gap: 0.375rem; margin-top: 4px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 0.6875rem; color: var(--text-secondary); cursor: pointer; text-align: left; }
        .bt-list { list-style: none; margin: 0.5rem 0 0; padding: 0; }
        .bt-list li { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0; border-bottom: 1px solid var(--bg-color); }
        .bt-list li:last-child { border-bottom: 0; }
      `}</style>

      <Navigation
        title="Battery tracking"
        showBack={true}
        backTo="/hub"
        titleAccessory={todayCount !== null ? (
          <button
            type="button"
            className="ds-chip live"
            onClick={() => setShowScans(true)}
            aria-label="Show today's scans"
            style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >
            <span className="mono">{todayCount}</span> today
          </button>
        ) : undefined}
      />

      <main className="ds-page narrow bt-main">
        <section
          className={`bt-scan ${scanning ? 'live' : 'idle'}`}
          onClick={!scanning ? startScanner : undefined}
          role={!scanning ? 'button' : undefined}
          tabIndex={!scanning ? 0 : undefined}
          onKeyDown={!scanning ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startScanner(); } } : undefined}
          aria-label={!scanning ? 'Start barcode scanner' : undefined}
        >
          {scanning ? (
            <div className="bt-live">
              <div id="reader"></div>
              <button
                type="button"
                className="ds-iconbtn"
                onClick={(e) => { e.stopPropagation(); stopScanner(); }}
                aria-label="Stop scanning"
                style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, borderRadius: '50%', background: 'var(--danger-color)', borderColor: 'var(--danger-color)', color: '#fff' }}
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <>
              <div className="grid" />
              <div className="bt-frame">
                <span className="bt-corner" style={{ left: 0, top: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 }} />
                <span className="bt-corner" style={{ right: 0, top: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 }} />
                <span className="bt-corner" style={{ left: 0, bottom: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 }} />
                <span className="bt-corner" style={{ right: 0, bottom: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 }} />
                <span className="bt-line" />
              </div>
              <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="ds-btn sm" style={{ background: '#0B7A55', color: '#fff', height: 40, pointerEvents: 'none' }}>
                  <Camera size={18} /> Tap to scan barcode
                </span>
              </div>
            </>
          )}
        </section>

        <section className="ds-card bt-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>Battery record</h2>
            <button type="button" className={`ds-btn sm ${isManual ? 'ink' : 'outline'}`} onClick={() => setIsManual(!isManual)} aria-pressed={isManual} style={{ height: 36, padding: '0 0.75rem', fontSize: '0.8125rem' }}>
              <Keyboard size={16} /> {isManual ? 'Typing' : 'Type serial'}
            </button>
          </div>

          <div>
            <label htmlFor="bt-serial" className="ds-label">Serial number</label>
            {isManual ? (
              <input
                id="bt-serial"
                className="ds-fld mono"
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="Enter SN manually"
                autoFocus
              />
            ) : (
              <div id="bt-serial" className={`bt-serial mono ${serialNumber ? 'has' : 'empty'}`} aria-live="polite">
                {serialNumber || 'Awaiting scan...'}
              </div>
            )}
            {lastScan && (
              <button type="button" className="bt-last" onClick={() => setShowScans(true)}>
                <History size={12} />
                Last: <span className="mono">{fmtTime(lastScan.at, true)}</span> · {lastScan.status}
                {history.length > 1 && <> · {history.length} scans</>}
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
            <div>
              <label htmlFor="bt-part" className="ds-label">Part no. <span style={{ fontWeight: 500 }}>(optional)</span></label>
              <input id="bt-part" className="ds-fld mono" type="text" value={partNumber} onChange={e => setPartNumber(e.target.value)} placeholder="5G0915105" style={{ fontSize: '0.875rem' }} />
            </div>
            <div>
              <label htmlFor="bt-loc" className="ds-label">Location / rack</label>
              <input id="bt-loc" className="ds-fld" type="text" value={locationId} onChange={e => setLocationId(e.target.value)} placeholder="Rack 4A" style={{ fontSize: '0.875rem' }} />
            </div>
          </div>

          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="ds-label" style={{ padding: 0 }}>Status</legend>
            <div className="bt-status">
              {STATUSES.map(s => (
                <label key={s.value} className={`bt-opt ${status === s.value ? 'on' : ''}`} title={s.hint || undefined}>
                  <input type="radio" name="battery-status" value={s.value} checked={status === s.value} onChange={() => setStatus(s.value)} />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          <button type="button" className="ds-btn signal block" onClick={handleSave} disabled={!serialNumber || saving} style={{ marginTop: '0.25rem' }}>
            {saving ? 'Saving...' : 'Save battery record'}
          </button>
        </section>
      </main>

      {showScans && (
        <div className="ds-overlay" style={{ alignItems: 'flex-end' }} role="dialog" aria-modal="true" aria-labelledby="bt-scans-title" onClick={() => setShowScans(false)}>
          <div className="ds-modal" style={{ maxHeight: '80%', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <h3 id="bt-scans-title" style={{ margin: 0 }}>Scans</h3>
              <button type="button" className="ds-iconbtn ghost" aria-label="Close" onClick={() => setShowScans(false)}>
                <X size={18} />
              </button>
            </div>

            {serialNumber && history.length > 0 && (
              <>
                <div className="eyebrow" style={{ marginTop: '1rem' }}>This battery · <span className="mono">{serialNumber}</span></div>
                <ul className="bt-list">{history.map(r => renderScanRow(r, true))}</ul>
              </>
            )}

            <div className="eyebrow" style={{ marginTop: '1rem' }}>Today</div>
            {recent.length > 0
              ? <ul className="bt-list">{recent.map(r => renderScanRow(r, false))}</ul>
              : <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>No scans yet today.</p>}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
