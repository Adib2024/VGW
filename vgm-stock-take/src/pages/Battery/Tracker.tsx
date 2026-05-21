import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Navigation } from '../../components/Navigation';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Camera, Save, X, Edit2, Battery } from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

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

  const startScanner = () => {
    setScanning(true);
    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: {width: 250, height: 150}, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
        false
      );
      
      scannerRef.current.render(
        (decodedText) => {
          setSerialNumber(decodedText);
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
    if (!serialNumber) {
      addToast('Please scan or enter a serial number', 'error');
      return;
    }
    
    // Check if exists
    const { data: existing } = await supabase
      .from('battery_tracking')
      .select('id')
      .eq('battery_serial_number', serialNumber)
      .single();

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
        .eq('battery_serial_number', serialNumber);
        
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
          battery_serial_number: serialNumber,
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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background-color)' }}>
      <Navigation title="Battery Scanner" showBack={false} />
      
      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Header Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
           <div style={{ width: '60px', height: '60px', borderRadius: '16px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
             <Battery size={32} />
           </div>
        </div>

        {/* Camera Viewfinder */}
        <Card style={{ marginBottom: '1.5rem', overflow: 'hidden', padding: scanning ? '0' : '1rem' }}>
          {scanning ? (
            <div style={{ position: 'relative' }}>
              <div id="reader" style={{ width: '100%', minHeight: '300px' }}></div>
              <Button 
                variant="danger" 
                onClick={stopScanner}
                style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, padding: '0.5rem' }}
              >
                <X size={20} />
              </Button>
            </div>
          ) : (
            <div 
              style={{ 
                height: '220px', 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center',
                backgroundColor: '#0f172a',
                color: 'white',
                cursor: 'pointer',
                borderRadius: '12px'
              }}
              onClick={startScanner}
            >
              <Camera size={56} color="#38bdf8" style={{ marginBottom: '1rem' }} />
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem' }}>Tap to Scan Barcode</h3>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.7, fontSize: '0.9rem' }}>Align barcode within the laser frame</p>
            </div>
          )}
        </Card>

        {/* Battery Details Form */}
        <Card style={{ padding: '1.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 800 }}>Battery Record</h3>
            <Button variant="secondary" onClick={() => setIsManual(!isManual)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
              <Edit2 size={14} style={{ marginRight: '0.35rem' }} />
              {isManual ? 'Cancel Manual' : 'Manual Entry'}
            </Button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Serial Number</label>
              {isManual ? (
                <input 
                  type="text" 
                  value={serialNumber} 
                  onChange={e => setSerialNumber(e.target.value)}
                  style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }}
                  placeholder="Enter SN manually"
                />
              ) : (
                <div style={{ 
                    padding: '1rem', 
                    backgroundColor: serialNumber ? '#f0fdf4' : '#f8fafc', 
                    borderRadius: '8px', 
                    border: serialNumber ? '2px solid #86efac' : '2px dashed #cbd5e1', 
                    color: serialNumber ? '#166534' : '#94a3b8', 
                    fontWeight: serialNumber ? 800 : 500,
                    fontSize: '1.1rem',
                    textAlign: 'center',
                    wordBreak: 'break-all'
                }}>
                  {serialNumber || 'Awaiting scan...'}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Part Number (Optional)</label>
              <input 
                type="text" 
                value={partNumber} 
                onChange={e => setPartNumber(e.target.value)}
                style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }}
                placeholder="e.g. 5G0915105"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Location / Rack</label>
              <input 
                type="text" 
                value={locationId} 
                onChange={e => setLocationId(e.target.value)}
                style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }}
                placeholder="e.g. Rack 4A"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Status</label>
              <select 
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
              >
                <option value="Scanned">Scanned (Awaiting Action)</option>
                <option value="Charged">Charged</option>
                <option value="Deployed">Deployed</option>
                <option value="Faulty">Faulty / Return</option>
              </select>
            </div>

            <Button 
              variant="primary" 
              onClick={handleSave} 
              style={{ width: '100%', padding: '1.2rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 700 }}
              disabled={!serialNumber}
            >
              <Save size={24} />
              Save Battery Record
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
