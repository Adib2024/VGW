import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Navigation } from '../../components/Navigation';
import { Camera, X, Keyboard, ScanLine } from 'lucide-react';
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

interface RecentScan {
  battery_serial_number: string;
  status: string;
  created_at: string;
}

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
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const fetchToday = async () => {
    const since = startOfTodayMalaysiaISO();
    const [{ count }, { data }] = await Promise.all([
      supabase.from('battery_tracking').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('battery_tracking').select('battery_serial_number, status, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(5),
    ]);
    setTodayCount(count ?? 0);
    setRecent((data as RecentScan[]) || []);
  };

  useEffect(() => { fetchToday(); }, []);

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
        (_error) => {
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

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        .bt-scan {
          position: relative; overflow: hidden; height: 280px; margin-top: 0.25rem;
          border-radius: var(--radius-panel); background: var(--primary-color); color: #fff;
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
        }
        .bt-scan.idle { cursor: pointer; }
        .bt-scan .grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .bt-corner { position: absolute; width: 34px; height: 34px; border: 0 solid #3DDC97; }
        .bt-line { position: absolute; left: 18%; right: 18%; top: 46%; height: 2px; background: #3DDC97; box-shadow: 0 0 14px 2px rgba(61,220,151,0.6); animation: bt-sweep 2.4s ease-in-out infinite alternate; }
        @keyframes bt-sweep { from { top: 26%; } to { top: 70%; } }
        @media (prefers-reduced-motion: reduce) { .bt-line { animation: none; } }
        .bt-live { position: absolute; inset: 0; background: #000; }
        .bt-live #reader { width: 100%; height: 100%; border: 0 !important; }
        .bt-status { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
        .bt-opt {
          display: flex; align-items: center; gap: 0.625rem; min-height: 52px; padding: 0 0.875rem;
          border-radius: var(--radius-md); border: 1.5px solid var(--border-color); background: #FAF9F6;
          font-size: 0.875rem; font-weight: 700; cursor: pointer;
        }
        .bt-opt input { width: 18px; height: 18px; margin: 0; accent-color: #0B7A55; }
        .bt-opt.on { border: 2px solid #0B7A55; background: var(--success-bg); }
        .bt-serial { min-height: 52px; display: flex; align-items: center; padding: 0 1rem; border-radius: var(--radius-md); font-weight: 700; word-break: break-all; }
        .bt-serial.has { border: 1.5px solid #0B7A55; background: var(--success-bg); color: var(--success-text); }
        .bt-serial.empty { border: 1.5px dashed #8A8F99; background: #FAF9F6; color: var(--text-secondary); font-family: var(--font-body); font-weight: 600; }
        .bt-recent { list-style: none; margin: 0; padding: 0.125rem 1rem; }
        .bt-recent li { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--bg-color); }
        .bt-recent li:last-child { border-bottom: 0; }
      `}</style>

      <Navigation
        title="Battery tracking"
        showBack={true}
        backTo="/hub"
        titleAccessory={todayCount !== null ? <span className="ds-chip live"><span className="mono">{todayCount}</span> today</span> : undefined}
      />

      <main className="ds-page narrow" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <section
          className={`bt-scan ${scanning ? '' : 'idle'}`}
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
              <span className="bt-corner" style={{ left: '18%', top: '18%', borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 }} />
              <span className="bt-corner" style={{ right: '18%', top: '18%', borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 }} />
              <span className="bt-corner" style={{ left: '18%', bottom: '30%', borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 }} />
              <span className="bt-corner" style={{ right: '18%', bottom: '30%', borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 }} />
              <span className="bt-line" />
              <div style={{ position: 'absolute', bottom: 22, left: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><ScanLine size={18} /> Tap to scan barcode</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-on-dark)' }}>Point the camera at the serial label</div>
              </div>
            </>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '0.625rem', marginTop: '0.75rem' }}>
          <button type="button" className="ds-btn" style={{ background: '#0B7A55', color: '#fff' }} onClick={scanning ? stopScanner : startScanner}>
            <Camera size={20} /> {scanning ? 'Stop camera' : 'Start camera'}
          </button>
          <button type="button" className={`ds-btn ${isManual ? 'ink' : 'outline'}`} onClick={() => setIsManual(!isManual)} aria-pressed={isManual}>
            <Keyboard size={18} /> {isManual ? 'Typing' : 'Type serial'}
          </button>
        </div>

        <section className="ds-card" style={{ padding: '1.125rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.0625rem' }}>Battery record</h2>

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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.625rem' }}>
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
                <label key={s.value} className={`bt-opt ${status === s.value ? 'on' : ''}`}>
                  <input type="radio" name="battery-status" value={s.value} checked={status === s.value} onChange={() => setStatus(s.value)} />
                  <span>{s.label}{s.hint && <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{s.hint}</span>}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="button" className="ds-btn signal lg block" onClick={handleSave} disabled={!serialNumber || saving}>
            {saving ? 'Saving...' : 'Save battery record'}
          </button>
        </section>

        {recent.length > 0 && (
          <>
            <div className="ds-section-label">
              <h2 style={{ margin: 0, fontSize: '0.9375rem' }}>Recent scans</h2>
              <span className="hint">Today</span>
            </div>
            <ul className="ds-card bt-recent">
              {recent.map(r => {
                const [bg, fg] = STATUS_CHIP[r.status] || STATUS_CHIP.Scanned;
                return (
                  <li key={`${r.battery_serial_number}-${r.created_at}`}>
                    <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.battery_serial_number}</span>
                    <span className="ds-chip" style={{ background: bg, color: fg }}>{r.status}</span>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
