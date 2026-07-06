import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { supabase } from '../../lib/supabase';
import { Save, Lock, Edit3, Circle, Loader2, PackageX } from 'lucide-react';

import { Part } from '../../types/database';

export default function StockTakeCounting() {
  const { table, id } = useParams<{ table: string; id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { t } = useLanguage();

  const [part, setPart] = useState<Part | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isMounted = useRef(true);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [adminUnlock, setAdminUnlock] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    if (id) fetchPart();
    return () => { isMounted.current = false; };
  }, [id]);

  const fetchPart = async () => {
    try {
      if (!table || !id) throw new Error('Missing parameters');
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      if (isMounted.current) {
        setPart(data);
        const initialForm: Record<string, string> = {};
        Object.keys(data).forEach(key => {
          if (data[key] !== null && data[key] !== undefined) {
            if (/remark|luqman/i.test(key)) {
              initialForm[key] = ''; // Start empty for typing new remark
            } else {
              initialForm[key] = String(data[key]);
            }
          }
        });
        setFormData(initialForm);
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to load part details', 'error');
    } finally {
      if (isMounted.current) setLoading(false);
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
    if (user?.role?.startsWith('Counter B17') || user?.role?.startsWith('Counter B22')) {
      return true; // Operators can edit, but previously filled boxes are locked individually
    }
    return false;
  };

  const canEditRecount = () => {
    if (user?.role === 'Admin') return adminUnlock;
    if (user?.role === 'Verifier') {
      return true; // Verifiers can edit, but previously filled recounts are locked individually
    }
    return false;
  };

  const handleCancel = () => {
    if (!part) return;
    setIsEditing(false);
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
      const { error } = await supabase.from(table!).update({ status: 'Verified', verify_by: user?.name }).eq('id', id);
      if (error) throw error;
      addToast('Part Verified successfully', 'success');
      setIsEditing(false);
      await fetchPart();
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

      if (user?.role?.startsWith('Counter B17') || user?.role?.startsWith('Counter B22') || (user?.role === 'Admin' && adminUnlock)) {
        counterKeys.forEach(k => {
          updates[k] = formData[k] !== '' ? parseInt(formData[k]) : null;
        });
        if (boxTotal > 0 && (part.status === 'Not Counted' || part.status === 'Verified')) {
          newStatus = 'Counted';
        }
      }

      if (user?.role === 'Verifier' || (user?.role === 'Admin' && adminUnlock)) {
        verifierKeys.forEach(k => {
          if (formData[k] !== '') {
            updates[k] = parseInt(formData[k]);
          } else {
            updates[k] = null;
          }
        });
        // Saving a recount does NOT automatically verify
      }

      // Remarks logic (Append) for anyone who can edit
      remarkKeys.forEach(k => {
        if (formData[k] && formData[k].trim() !== '') {
          const timestamp = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          const newRemark = `[${timestamp} ${user?.name}]: ${formData[k].trim()}`;
          updates[k] = part[k] ? `${part[k]} | ${newRemark}` : newRemark;
        }
      });

      updates.status = newStatus;
      const { error } = await supabase.from(table!).update(updates).eq('id', id);
      if (error) throw error;

      addToast('Data saved successfully', 'success');
      setIsEditing(false);
      await fetchPart();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to save data', 'error');
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
      <Loader2 size={32} className="animate-spin" />
      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('loadingData')}</span>
    </div>
  );
  if (!part) return <EmptyState icon={<PackageX size={40} strokeWidth={1.5} />} message={t('noParts')} />;

  const counterKeys = part ? Object.keys(part).filter(k => /box|seq/i.test(k)).sort() : [];
  const verifierKeys = part ? Object.keys(part).filter(k => /recount/i.test(k)).sort() : [];
  const remarkKeys = part ? Object.keys(part).filter(k => /remark|luqman/i.test(k)).sort() : [];
  
  const getDisplayColumns = () => {
    const exclude = ['id', 'batch_id', 'status', '_table', 'no']; // 'no' is displayed prominently at the top
    return Object.keys(part).filter(k => !exclude.includes(k) && !/box|seq|recount|remark|luqman/i.test(k));
  };
  const displayCols = getDisplayColumns();

  const getVisibleKeys = (keys: string[]) => {
    const visible: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      visible.push(key);
      if (!formData[key] || formData[key].trim() === '') {
        break;
      }
    }
    return visible;
  };

  const visibleCounterKeys = getVisibleKeys(counterKeys);
  const visibleVerifierKeys = getVisibleKeys(verifierKeys);

  const formatKeyName = (key: string) => {
    if (key.toLowerCase().includes('box_')) return key.replace(/_/g, ' ').replace('box', 'Box').replace(/\b\w/g, c => c.toUpperCase());
    if (key.toLowerCase().includes('recount_')) return key.replace(/_/g, ' ').replace('recount', 'Recount').replace(/\b\w/g, c => c.toUpperCase());
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar Actions */}
      <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <button 
          onClick={() => navigate(`/stock-take/list?table=${table}`)}
          style={{ padding: '0.5rem 1.5rem', backgroundColor: '#e2e8f0', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
        >
          {t('back')}
        </button>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            COUNTER {table?.toUpperCase()} VIEW
          </div>
          <h1 style={{ margin: '0', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{t('itemDetails')}</h1>
        </div>
      </div>

      <main className="container" style={{ flex: 1, padding: '0 1rem 3rem 1rem', maxWidth: '600px', margin: '0 auto' }}>
        
        <Card style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none' }}>
          
          {/* Item ID & Edit Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--primary-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary-color)', margin: 0, lineHeight: 1 }}>
              {part.no || part.id}
            </h2>
            
            {!isEditing ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(canEditBox() || canEditRecount()) && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: 'var(--radius-md)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 600 }}
                  >
                    <Edit3 size={16} /> {t('edit')}
                  </button>
                )}
                {user?.role === 'Admin' && (
                  <button 
                    onClick={() => setAdminUnlock(!adminUnlock)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: 'var(--radius-md)', backgroundColor: adminUnlock ? '#f1f5f9' : 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}
                  >
                    <Lock size={16} /> {adminUnlock ? t('locked') : t('unlock')}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={handleCancel}
                  style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: 'var(--radius-md)', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSave} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', border: 'none', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-color)', cursor: 'pointer', color: 'white', fontWeight: 600 }}
                >
                  <Save size={16} /> {saving ? t('saving') : t('save')}
                </button>
              </div>
            )}
          </div>

          {/* Item Information Table */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#475569', marginBottom: '1rem', textTransform: 'uppercase' }}>{t('itemInformation')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayCols.map((col) => (
                <div key={col} style={{ display: 'flex', padding: '1rem 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: '120px', color: '#64748b', fontWeight: 600, fontSize: '0.875rem', textTransform: 'capitalize' }}>
                    {col.replace(/_/g, ' ')}
                  </div>
                  <div style={{ flex: 1, color: '#0f172a', fontWeight: 500, fontSize: '0.875rem' }}>
                    {part[col] || '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Count Data */}
          {(counterKeys.length > 0 || verifierKeys.length > 0) && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {t('countData')} <Circle size={18} fill="#334155" color="#334155" />
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {counterKeys.length > 0 && visibleCounterKeys.map(key => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', animation: 'fade-in 0.3s ease-out' }}>
                    <div style={{ width: '100px', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>
                      {formatKeyName(key)}
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="number"
                        value={formData[key] || ''}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        disabled={!isEditing || !canEditBox() || (user?.role !== 'Admin' && part[key] !== null && part[key] !== undefined && part[key] !== '')}
                        style={{
                          width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                          border: formData[key] ? '1px solid var(--success-color)' : '1px solid #cbd5e1',
                          backgroundColor: (!isEditing || !canEditBox() || (user?.role !== 'Admin' && part[key] !== null && part[key] !== undefined && part[key] !== '')) ? '#f8fafc' : 'white',
                          color: formData[key] ? 'var(--success-color)' : '#0f172a',
                          fontWeight: formData[key] ? 800 : 500, outline: 'none',
                          cursor: (!isEditing || !canEditBox() || (user?.role !== 'Admin' && part[key] !== null && part[key] !== undefined)) ? 'not-allowed' : 'text'
                        }}
                        placeholder=""
                      />
                      {formData[key] && (
                         <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--success-color)' }}>
                           <Circle size={10} fill="var(--success-color)" />
                         </div>
                      )}
                    </div>
                  </div>
                ))}

                {verifierKeys.length > 0 && user?.role !== 'Counter B17' && user?.role !== 'Counter B22' && visibleVerifierKeys.map(key => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', animation: 'fade-in 0.3s ease-out', marginTop: '1rem' }}>
                    <div style={{ width: '100px', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>
                      {formatKeyName(key)}
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="number"
                        value={formData[key] || ''}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        disabled={!isEditing || !canEditRecount()}
                        style={{
                          width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                          border: formData[key] ? '1px solid var(--primary-color)' : '1px solid #cbd5e1',
                          backgroundColor: (!isEditing || !canEditRecount()) ? '#f8fafc' : 'white',
                          color: formData[key] ? 'var(--primary-color)' : '#0f172a',
                          fontWeight: formData[key] ? 800 : 500, outline: 'none',
                          cursor: (!isEditing || !canEditRecount()) ? 'not-allowed' : 'text'
                        }}
                      />
                       {formData[key] && (
                         <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary-color)' }}>
                           <Circle size={10} fill="var(--primary-color)" />
                         </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status & Remarks */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', padding: '1rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: '120px', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>{t('status')}</div>
              <div style={{ flex: 1, color: '#0f172a', fontWeight: 800, fontSize: '0.875rem' }}>
                {part.status === 'Verified' ? t('verified') : part.status === 'Counted' ? t('counted') : t('notCounted')}
              </div>
              {!isEditing && canEditRecount() && part.status === 'Counted' && (
                  <Button onClick={handleVerify} style={{ padding: '0.25rem 1rem', backgroundColor: 'var(--success-color)', fontSize: '0.75rem', marginLeft: 'auto' }}>
                    {t('verifyNow')}
                  </Button>
              )}
            </div>
            
            <div style={{ display: 'flex', padding: '1rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: '120px', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>{t('verifiedBy')}</div>
              <div style={{ flex: 1, color: '#0f172a', fontWeight: 500, fontSize: '0.875rem' }}>{part.verify_by || '-'}</div>
            </div>

            {remarkKeys.length > 0 && remarkKeys.map(key => (
              <div key={key} style={{ display: 'flex', padding: '1.5rem 0 0 0', alignItems: 'flex-start' }}>
                <div style={{ width: '120px', color: '#64748b', fontWeight: 600, fontSize: '0.875rem', marginTop: '0.75rem' }}>{formatKeyName(key)}</div>
                <div style={{ flex: 1 }}>
                   {part[key] && (
                     <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', color: '#475569' }}>
                       {part[key].split(' | ').map((r: string, i: number) => <div key={i} style={{ marginBottom: '0.25rem' }}>{r}</div>)}
                     </div>
                   )}
                   <textarea
                     value={formData[key] || ''}
                     onChange={(e) => handleInputChange(key, e.target.value)}
                     disabled={!isEditing || (!canEditBox() && !canEditRecount())}
                     placeholder={t('addRemarkPlaceholder')}
                     rows={2}
                     style={{
                       width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                       border: '2px dashed var(--warning-color)', backgroundColor: formData[key] ? 'white' : '#fffbeb',
                       color: '#d97706', outline: 'none', resize: 'none',
                       fontFamily: 'inherit', fontSize: '0.875rem',
                       cursor: (!isEditing || (!canEditBox() && !canEditRecount())) ? 'not-allowed' : 'text'
                     }}
                   />
                </div>
              </div>
            ))}
          </div>

        </Card>
      </main>
      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
}
