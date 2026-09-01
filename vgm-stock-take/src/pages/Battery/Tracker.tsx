import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Navigation } from '../../components/Navigation';
import { BackgroundDecor } from '../../components/ui/BackgroundDecor';
import { Camera, Save, X, Edit2, Battery } from 'lucide-react';
import type { Html5QrcodeScanner } from 'html5-qrcode';

export default function Tracker() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [serialNumber, setSerialNumber] = useState('');
  const [locationId, setLocationId] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [status, setStatus] = useState('Scanned');
  const [isManual, setIsManual] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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
      }
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
        .bt-panel {
          position: relative;
          background: var(--surface-color);
          border-radius: var(--radius-panel);
          box-shadow: 0 10px 30px -8px rgba(5,150,105,0.16), 0 2px 8px -2px rgba(5,150,105,0.06);
          overflow: hidden;
        }
        .bt-panel::before, .bt-panel::after { content: ''; position: absolute; width: 14px; height: 14px; opacity: 0.55; }
        .bt-panel::before { top: 10px; left: 10px; border-top: 2px solid var(--success-color); border-left: 2px solid var(--success-color); border-radius: 3px 0 0 0; }
        .bt-panel::after { bottom: 10px; right: 10px; border-bottom: 2px solid var(--success-color); border-right: 2px solid var(--success-color); border-radius: 0 0 3px 0; }

        .bt-module-id { display: flex; align-items: center; gap: 0.9rem; padding: 1.4rem 1.5rem; }
        .bt-module-icon {
          width: 46px; height: 46px; border-radius: var(--radius-card); flex-shrink: 0;
          background: rgba(5,150,105,0.1); box-shadow: inset 0 0 0 1.5px var(--success-color);
          display: flex; align-items: center; justify-content: center; color: var(--success-color);
        }
        .bt-module-id h1 { font-size: 1.1rem; font-weight: 700; color: var(--primary-color); margin: 0; }
        .bt-module-id .bt-sub { font-size: 0.78rem; color: var(--text-secondary); font-weight: 500; margin-top: 0.15rem; }

        .bt-scan-zone {
          margin: 0 1.5rem 1.5rem;
          height: 220px; border-radius: var(--radius-lg);
          background:
            radial-gradient(420px 220px at 50% 0%, rgba(5,150,105,0.18) 0%, transparent 65%),
            linear-gradient(155deg, #0b1220 0%, #06090f 100%);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          color: #fff; cursor: pointer; position: relative; overflow: hidden; text-align: center;
        }
        .bt-scan-zone::before {
          content: ''; position: absolute; inset: 14px; border-radius: var(--radius-card);
          border: 2px dashed rgba(52, 211, 153, 0.35); pointer-events: none;
        }
        .bt-scan-zone h3 { font-size: 1.05rem; font-weight: 700; margin: 0.9rem 0 0; }
        .bt-scan-zone p { margin-top: 0.4rem; font-size: 0.82rem; color: rgba(255,255,255,0.55); }
        .bt-scan-live { position: relative; width: 100%; height: 100%; }
        .bt-scan-stop {
          position: absolute; top: 10px; right: 10px; z-index: 10; width: 34px; height: 34px;
          border-radius: 50%; border: none; background: var(--danger-color); color: #fff;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }

        .bt-form-head { display: flex; justify-content: space-between; align-items: center; padding: 1.4rem 1.5rem 1.1rem; border-top: 1px solid var(--surface-highlight); }
        .bt-form-head h2 { font-size: 1rem; font-weight: 800; color: var(--text-primary); margin: 0; }
        .bt-manual-toggle {
          display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.75rem; border-radius: var(--radius-full);
          border: 1px solid var(--border-color); background: var(--surface-color); font-size: 0.75rem; font-weight: 700;
          color: var(--text-secondary); cursor: pointer;
        }

        .bt-field { padding: 0 1.5rem; margin-bottom: 1.1rem; }
        .bt-field label { display: block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 0.5rem; }
        .bt-field input, .bt-field select {
          width: 100%; padding: 0.8rem 1rem; border-radius: var(--radius-md); border: 1px solid transparent;
          background: var(--surface-highlight); font-size: 0.95rem; font-family: inherit; color: var(--text-primary); outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .bt-field input:focus, .bt-field select:focus { border-color: var(--success-color); background: var(--surface-color); }

        .bt-serial-readout {
          padding: 1rem; border-radius: var(--radius-md); text-align: center; font-weight: 800; font-size: 1.05rem;
          word-break: break-all; font-variant-numeric: tabular-nums;
          background: rgba(5,150,105,0.1); border: 2px solid var(--success-color); color: var(--success-text);
        }
        .bt-serial-readout.empty { background: var(--surface-highlight); border: 2px dashed var(--border-color); color: var(--text-secondary); font-weight: 500; border-color: #cbd5e1; }

        .bt-save-btn {
          margin: 0.5rem 1.5rem 1.5rem; padding: 1rem; border: none; border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--success-color) 0%, #047857 100%);
          color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.6rem;
          box-shadow: 0 10px 22px rgba(5,150,105,0.28);
        }
        .bt-save-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
      `}</style>

      <BackgroundDecor />
      <Navigation title="Battery Scanner" showBack={true} backTo="/hub" />

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '1.5rem 1.25rem 3rem' }}>
        <div className="bt-panel">
          <div className="bt-module-id">
            <div className="bt-module-icon"><Battery size={22} /></div>
            <div>
              <h1>Battery Tracking</h1>
              <div className="bt-sub">Scan or enter a serial to log a record</div>
            </div>
          </div>

          <div className="bt-scan-zone" onClick={!scanning ? startScanner : undefined}>
            {scanning ? (
              <div className="bt-scan-live">
                <div id="reader" style={{ width: '100%', minHeight: '220px' }}></div>
                <button className="bt-scan-stop" onClick={(e) => { e.stopPropagation(); stopScanner(); }} aria-label="Stop scanning">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <Camera size={44} color="#34d399" style={{ filter: 'drop-shadow(0 0 10px rgba(52,211,153,0.4))' }} />
                <h3>Tap to Scan Barcode</h3>
                <p>Align the barcode within the frame</p>
              </>
            )}
          </div>

          <div className="bt-form-head">
            <h2>Battery Record</h2>
            <button className="bt-manual-toggle" onClick={() => setIsManual(!isManual)}>
              <Edit2 size={12} />
              {isManual ? 'Cancel Manual' : 'Manual Entry'}
            </button>
          </div>

          <div className="bt-field">
            <label>Serial Number</label>
            {isManual ? (
              <input
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="Enter SN manually"
              />
            ) : (
              <div className={`bt-serial-readout ${serialNumber ? '' : 'empty'}`}>
                {serialNumber || 'Awaiting scan...'}
              </div>
            )}
          </div>

          <div className="bt-field">
            <label>Part Number <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span></label>
            <input
              type="text"
              value={partNumber}
              onChange={e => setPartNumber(e.target.value)}
              placeholder="e.g. 5G0915105"
            />
          </div>

          <div className="bt-field">
            <label>Location / Rack</label>
            <input
              type="text"
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              placeholder="e.g. Rack 4A"
            />
          </div>

          <div className="bt-field">
            <label htmlFor="battery-status">Status</label>
            <select id="battery-status" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="Scanned">Scanned (Awaiting Action)</option>
              <option value="Charged">Charged</option>
              <option value="Deployed">Deployed</option>
              <option value="Faulty">Faulty / Return</option>
            </select>
          </div>

          <button className="bt-save-btn" onClick={handleSave} disabled={!serialNumber}>
            <Save size={20} />
            Save Battery Record
          </button>
        </div>
      </main>
    </div>
  );
}
