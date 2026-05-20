import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navigation } from '../../components/Navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
// import { Part } from '../../types/database';
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

  const [part, setPart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dynamic Form State
  const [formData, setFormData] = useState<Record<string, string>>({});

  // UI State
  const [isEditing, setIsEditing] = useState(false);
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

      // Initialize form data with existing values
      const initialForm: Record<string, string> = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined) {
          initialForm[key] = String(data[key]);
        }
      });
      setFormData(initialForm);

    } catch (err) {
      console.error(err);
      addToast('Failed to load part details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const calculateTotal = (keys: string[]) => {
    return keys.reduce((acc, key) => acc + (parseInt(formData[key]) || 0), 0);
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

  const handleCancel = () => {
    setIsEditing(false);
    // Reset formData to original part values
    const initialForm: Record<string, string> = {};
    Object.keys(part).forEach(key => {
      if (part[key] !== null && part[key] !== undefined) {
        initialForm[key] = String(part[key]);
      }
    });
    setFormData(initialForm);
  };

  const handleVerify = async () => {
    if (!part) return;
    setSaving(true);
    try {
      const { error } = await supabase.from(table!).update({ status: 'Verified' }).eq('id', id);
      if (error) throw error;
      addToast('Part Verified successfully', 'success');
      navigate('/stock-take/list');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to verify', 'error');
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!part) return;
    setSaving(true);

    try {
      const updates: any = {};
      let newStatus = part.status;

      const counterKeys = Object.keys(part).filter(k => /box|seq/i.test(k));
      const verifierKeys = Object.keys(part).filter(k => /recount/i.test(k));
      const remarkKeys = Object.keys(part).filter(k => /remark|luqman/i.test(k));

      const boxTotal = calculateTotal(counterKeys);

      // Counter Logic
      if (user?.role === 'Counter B17' || user?.role === 'Counter B22' || (user?.role === 'Admin' && adminUnlock)) {
        counterKeys.forEach(k => {
          updates[k] = formData[k] !== '' ? parseInt(formData[k]) : null;
        });
        remarkKeys.forEach(k => {
          if (formData[k] !== undefined) updates[k] = formData[k];
        });

        if (boxTotal > 0 && part.status === 'Not Counted') {
          newStatus = 'Counted';
        }
      }

      // Verifier Logic
      if (user?.role === 'Verifier' || (user?.role === 'Admin' && adminUnlock)) {
        let hasRecounts = false;
        verifierKeys.forEach(k => {
          if (formData[k] !== '') {
            hasRecounts = true;
            updates[k] = parseInt(formData[k]);
          } else {
            updates[k] = null;
          }
        });

        if (hasRecounts) {
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

  const counterKeys = part ? Object.keys(part).filter(k => /box|seq/i.test(k)).sort() : [];
  const verifierKeys = part ? Object.keys(part).filter(k => /recount/i.test(k)).sort() : [];
  const remarkKeys = part ? Object.keys(part).filter(k => /remark|luqman/i.test(k)).sort() : [];

  const boxTotal = calculateTotal(counterKeys);

  const getDisplayColumns = () => {
    const exclude = ['id', 'batch_id', 'status', '_table'];
    return Object.keys(part).filter(k => !exclude.includes(k) && !/box|seq|recount|remark|luqman/i.test(k)).slice(0, 3);
  };
  const displayCols = getDisplayColumns();

  // Waterfall logic: only show up to the first empty input
  const getVisibleKeys = (keys: string[]) => {
    const visible: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      visible.push(key);
      if (!formData[key] || formData[key].trim() === '') {
        break; // Stop showing more keys after the first empty one
      }
    }
    return visible;
  };

  const visibleCounterKeys = getVisibleKeys(counterKeys);
  const visibleVerifierKeys = getVisibleKeys(verifierKeys);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation title="Counting Interface" backTo="/stock-take/list" />

      <main className="container" style={{ flex: 1, padding: '2rem 1rem', maxWidth: '800px' }}>
        {/* Header info */}
        <Card style={{ marginBottom: '1.5rem', backgroundColor: 'var(--surface-highlight)', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Part Information</p>
            {displayCols.map((col, idx) => (
              <div key={col} style={{ marginTop: idx === 0 ? '0.5rem' : '0.25rem' }}>
                <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', marginRight: '0.5rem' }}>{col.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: idx === 0 ? 800 : 500, fontSize: idx === 0 ? '1.25rem' : '1rem' }}>{part[col] || '-'}</span>
              </div>
            ))}
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

            {/* Box Counting Section (Dynamic) */}
            {counterKeys.length > 0 && (
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Counter Inputs
                  {!canEditBox() && <Lock size={16} color="var(--text-secondary)" />}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleCounterKeys.map((key) => (
                    <div key={key} style={{ animation: 'fade-in 0.3s ease-out' }}>
                      <Input
                        type="number"
                        label={key.replace(/_/g, ' ').toUpperCase()}
                        placeholder="0"
                        value={formData[key] || ''}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        disabled={!isEditing || !canEditBox()}
                        style={{
                          opacity: (isEditing && canEditBox()) ? 1 : 0.6,
                          backgroundColor: (isEditing && canEditBox()) ? 'var(--surface-color)' : 'rgba(0,0,0,0.2)'
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--surface-highlight)', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>Total:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{boxTotal}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Verifier Section */}
            {verifierKeys.length > 0 && (
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', paddingTop: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: canEditRecount() ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  Verifier Input
                  {!canEditRecount() && <Lock size={16} color="var(--text-secondary)" />}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleVerifierKeys.map(key => (
                    <div key={key} style={{ animation: 'fade-in 0.3s ease-out' }}>
                      <Input
                        type="number"
                        label={key.replace(/_/g, ' ').toUpperCase()}
                        placeholder="0"
                        value={formData[key] || ''}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        disabled={!isEditing || !canEditRecount()}
                        style={{
                          opacity: (isEditing && canEditRecount()) ? 1 : 0.6,
                          backgroundColor: (isEditing && canEditRecount()) ? 'var(--surface-color)' : 'rgba(0,0,0,0.2)'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remarks Section */}
            {remarkKeys.length > 0 && (
              <div style={{ paddingTop: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Remarks
                  {!canEditBox() && <Lock size={16} color="var(--text-secondary)" />}
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {remarkKeys.map(key => (
                    <Input
                      key={key}
                      type="text"
                      label={key.replace(/_/g, ' ').toUpperCase()}
                      value={formData[key] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      disabled={!isEditing || (!canEditBox() && !canEditRecount())}
                      style={{
                        opacity: (isEditing && (canEditBox() || canEditRecount())) ? 1 : 0.6,
                        backgroundColor: (isEditing && (canEditBox() || canEditRecount())) ? 'var(--surface-color)' : 'rgba(0,0,0,0.2)'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              {!isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => navigate('/stock-take/list')}>
                    Back
                  </Button>
                  {(canEditBox() || canEditRecount()) && (
                    <Button onClick={() => setIsEditing(true)}>
                      <Edit3 size={18} /> Edit
                    </Button>
                  )}
                  {canEditRecount() && part.status === 'Counted' && (
                    <Button onClick={handleVerify} style={{ backgroundColor: 'var(--success-color)' }}>
                      Verify
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={handleCancel}>
                    Batal
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save size={18} /> {saving ? 'Saving...' : 'Save Data'}
                  </Button>
                </>
              )}
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
