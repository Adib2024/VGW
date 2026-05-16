import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navigation } from '../../components/Navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Part } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { Save, Lock, Edit3 } from 'lucide-react';

export default function StockTakeCounting() {
  const { table, id } = useParams<{ table: string; id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [part, setPart] = useState<Part | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [boxes, setBoxes] = useState<string[]>(['', '', '', '', '']);
  const [recount, setRecount] = useState('');
  
  // UI State
  const [visibleBoxes, setVisibleBoxes] = useState(1);
  const [adminUnlock, setAdminUnlock] = useState(false);

  useEffect(() => {
    if (id) fetchPart();
  }, [id]);

  const fetchPart = async () => {
    try {
      if (!table || !id) throw new Error('Missing parameters');
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      
      setPart(data);
      
      const newBoxes = [
        data.box_1 !== null ? String(data.box_1) : '',
        data.box_2 !== null ? String(data.box_2) : '',
        data.box_3 !== null ? String(data.box_3) : '',
        data.box_4 !== null ? String(data.box_4) : '',
        data.box_5 !== null ? String(data.box_5) : '',
      ];
      setBoxes(newBoxes);
      setRecount(data.recount !== null ? String(data.recount) : '');
      
      // Determine visible boxes based on existing data
      let maxFilled = 0;
      for(let i=4; i>=0; i--) {
        if (newBoxes[i] !== '') {
          maxFilled = i;
          break;
        }
      }
      setVisibleBoxes(Math.min(5, maxFilled + 2)); // Show one extra box than the last filled
      
    } catch (err) {
      console.error(err);
      addToast('Failed to load part details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBoxChange = (index: number, value: string) => {
    const newBoxes = [...boxes];
    newBoxes[index] = value;
    setBoxes(newBoxes);
    
    // Waterfall logic: if current box is filled and next box is hidden, reveal it
    if (value.trim() !== '' && index + 1 === visibleBoxes && visibleBoxes < 5) {
      setVisibleBoxes(visibleBoxes + 1);
    }
  };

  const calculateTotal = (b: string[]) => {
    return b.reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
  };

  const canEditBox = () => {
    if (user?.role === 'Admin') return adminUnlock;
    if (user?.role === 'Counter B17' || user?.role === 'Counter B22') {
      // Counter can edit only if not already counted (unless admin unlocks, but admin is a different role)
      return part?.status === 'Not Counted';
    }
    return false; // Verifiers cannot edit boxes
  };

  const canEditRecount = () => {
    if (user?.role === 'Admin') return adminUnlock;
    if (user?.role === 'Verifier') {
      return part?.status === 'Counted'; // Verifier only edits if already counted
    }
    return false;
  };

  const handleSave = async () => {
    if (!part) return;
    setSaving(true);
    
    try {
      const updates: any = {
        last_updated: new Date().toISOString()
      };
      
      let newStatus = part.status;
      const boxTotal = calculateTotal(boxes);
      
      // Counter Logic
      if (user?.role === 'Counter B17' || user?.role === 'Counter B22' || (user?.role === 'Admin' && adminUnlock)) {
        updates.box_1 = boxes[0] !== '' ? parseInt(boxes[0]) : null;
        updates.box_2 = boxes[1] !== '' ? parseInt(boxes[1]) : null;
        updates.box_3 = boxes[2] !== '' ? parseInt(boxes[2]) : null;
        updates.box_4 = boxes[3] !== '' ? parseInt(boxes[3]) : null;
        updates.box_5 = boxes[4] !== '' ? parseInt(boxes[4]) : null;
        
        if (boxTotal > 0 && part.status === 'Not Counted') {
          newStatus = 'Counted';
        }
      }
      
      // Verifier Logic
      if (user?.role === 'Verifier' || (user?.role === 'Admin' && adminUnlock)) {
        if (recount !== '') {
          const recountVal = parseInt(recount);
          if (recountVal === boxTotal) {
             throw new Error('Recount value cannot equal Box Total.');
          }
          updates.recount = recountVal;
          newStatus = 'Verified';
        }
      }
      
      updates.status = newStatus;

      const { error } = await supabase.from(table!).update(updates).eq('id', id);
      if (error) throw error;
      
      addToast('Data saved successfully', 'success');
      navigate('/stock-take/list');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to save data', 'error');
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  if (!part) return <div style={{ padding: '2rem', textAlign: 'center' }}>Part not found</div>;

  const boxTotal = calculateTotal(boxes);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation title="Counting Interface" backTo="/stock-take/list" />
      
      <main className="container" style={{ flex: 1, padding: '2rem 1rem', maxWidth: '800px' }}>
        {/* Header info */}
        <Card style={{ marginBottom: '1.5rem', backgroundColor: 'var(--surface-highlight)', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Part Information</p>
            <h2 style={{ margin: '0.5rem 0' }}>{part.part_no}</h2>
            <p style={{ margin: 0 }}>{part.material} | {part.location}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Status</p>
            <h3 style={{ margin: '0.5rem 0', color: part.status === 'Verified' ? 'var(--success-color)' : part.status === 'Counted' ? 'var(--warning-color)' : 'var(--danger-color)' }}>
              {part.status}
            </h3>
            {user?.role === 'Admin' && (
              <Button 
                variant={adminUnlock ? 'primary' : 'secondary'} 
                onClick={() => setAdminUnlock(!adminUnlock)}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', marginTop: '0.5rem' }}
              >
                {adminUnlock ? <Lock size={14} /> : <Edit3 size={14} />} 
                {adminUnlock ? ' Lock' : ' Admin Unlock'}
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex-col gap-6">
            
            {/* Box Counting Section (Waterfall) */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Counter Inputs
                {!canEditBox() && <Lock size={16} color="var(--text-secondary)" />}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div key={index} style={{ 
                    display: index < visibleBoxes ? 'block' : 'none',
                    animation: 'fade-in 0.3s ease-out'
                  }}>
                    <Input 
                      type="number"
                      label={`Box ${index + 1}`}
                      placeholder="0"
                      value={boxes[index]}
                      onChange={(e) => handleBoxChange(index, e.target.value)}
                      disabled={!canEditBox()}
                      style={{ 
                        opacity: canEditBox() ? 1 : 0.6,
                        backgroundColor: canEditBox() ? 'var(--surface-color)' : 'rgba(0,0,0,0.2)'
                      }}
                    />
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--surface-highlight)', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>
                  <span style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>Box Total:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{boxTotal}</span>
                </div>
              </div>
            </div>

            {/* Verifier Section */}
            <div>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: canEditRecount() ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                Verifier Input
                {!canEditRecount() && <Lock size={16} color="var(--text-secondary)" />}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2">
                <Input 
                  type="number"
                  label="Recount Value"
                  placeholder="Enter recount total..."
                  value={recount}
                  onChange={(e) => setRecount(e.target.value)}
                  disabled={!canEditRecount()}
                  style={{ 
                    opacity: canEditRecount() ? 1 : 0.6,
                    backgroundColor: canEditRecount() ? 'var(--surface-color)' : 'rgba(0,0,0,0.2)'
                  }}
                />
              </div>
              {canEditRecount() && (
                <p style={{ fontSize: '0.875rem', color: 'var(--warning-color)', marginTop: '0.5rem' }}>
                  * Recount value must NOT equal the Box Total.
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <Button variant="secondary" onClick={() => navigate('/stock-take/list')}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || (!canEditBox() && !canEditRecount())}>
                <Save size={18} /> {saving ? 'Saving...' : 'Save Data'}
              </Button>
            </div>

          </div>
        </Card>
      </main>
      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
}
