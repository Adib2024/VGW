import { useState, useEffect, useRef } from 'react';
import { errorMessage } from '../../lib/errors';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Navigation } from '../../components/Navigation';
import { EmptyState } from '../../components/ui/EmptyState';
import { supabase } from '../../lib/supabase';
import { updateOrQueue, isNetworkError } from '../../lib/offlineQueue';
import { getCachedRow, patchCachedRow } from '../../lib/partCache';
import { ZONE_THEME, NEUTRAL_ZONE_THEME } from '../../lib/zoneTheme';
import { Loader2, PackageX, Minus, Plus, Check, ShieldCheck } from 'lucide-react';

import { Part } from '../../types/database';

const STEPS = ['Not Counted', 'Counted', 'Verified'] as const;

export default function StockTakeCounting() {
  const { table, id } = useParams<{ table: string; id: string }>();
  const [searchParams] = useSearchParams();
  const displayNo = searchParams.get('no');
  const location = useLocation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { t, tf } = useLanguage();

  const [part, setPart] = useState<Part | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isMounted = useRef(true);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [initialForm, setInitialForm] = useState<Record<string, string>>({});

  useEffect(() => {
    isMounted.current = true;
    if (id) fetchPart();
    return () => { isMounted.current = false; };
  }, [id]);

  const buildInitialForm = (data: Part) => {
    const form: Record<string, string> = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        if (/remark|luqman/i.test(key)) {
          form[key] = ''; // Start empty for typing new remark
        } else {
          form[key] = String(data[key]);
        }
      }
    });
    return form;
  };

  const showPart = (data: Part) => {
    setPart(data);
    const form = buildInitialForm(data);
    setFormData(form);
    setInitialForm(form);
  };

  const fetchPart = async () => {
    try {
      if (!table || !id) throw new Error('Missing parameters');
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      if (isMounted.current) showPart(data);
    } catch (err) {
      console.error(err);
      // No signal: fall back to the copy of this part from the list the
      // counter already loaded, so they can still count it.
      const fallback = (location.state as { part?: Part } | null)?.part || (table && id ? getCachedRow(table, id) : undefined);
      if (fallback && isNetworkError(err as { message?: string })) {
        if (isMounted.current) showPart(fallback);
        addToast(t('showingCached'), 'info');
      } else {
        addToast('Failed to load part details', 'error');
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  // Persist a change now, or queue it if there's no signal. When queued,
  // the screen and the list cache show the change straight away.
  const commit = async (updates: Record<string, unknown>, savedMsg: string) => {
    if (!part || !table || !id) return;
    // Record when it actually happened (matters for offline saves synced later);
    // only if sql/008_activity_tracking.sql has added the column.
    if ('updated_at' in part) updates.updated_at = new Date().toISOString();

    const result = await updateOrQueue(table, id, updates);
    patchCachedRow(table, id, updates);
    if (result === 'saved') {
      addToast(savedMsg, 'success');
      await fetchPart();
    } else {
      addToast(t('savedOffline'), 'info');
      if (isMounted.current) showPart({ ...part, ...updates } as Part);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const stepValue = (key: string, delta: number) => {
    const next = Math.max(0, (parseInt(formData[key]) || 0) + delta);
    handleInputChange(key, String(next));
  };

  const calculateTotal = (keys: string[]) => {
    return keys.reduce((acc, key) => acc + (parseInt(formData[key]) || 0), 0);
  };

  const canEditBox = () => {
    if (user?.role === 'Admin') return true;
    if (user?.role?.startsWith('Counter B17') || user?.role?.startsWith('Counter B22')) {
      return true; // Operators can edit, but previously filled boxes are locked individually
    }
    return false;
  };

  const canEditRecount = () => {
    if (user?.role === 'Admin') return true;
    if (user?.role === 'Verifier') {
      return true; // Verifiers can edit, but previously filled recounts are locked individually
    }
    return false;
  };

  // A box a non-Admin already saved stays locked - counters can only fill
  // the next empty one, never overwrite a colleague's count.
  const isBoxLocked = (key: string) =>
    !canEditBox() || (user?.role !== 'Admin' && part?.[key] !== null && part?.[key] !== undefined && part?.[key] !== '');

  const isDirty = Object.keys({ ...formData, ...initialForm }).some(k => (formData[k] ?? '') !== (initialForm[k] ?? ''));

  const handleReset = () => setFormData(initialForm);

  const handleVerify = async () => {
    if (!part) return;
    setSaving(true);
    try {
      await commit({ status: 'Verified', verify_by: user?.name }, 'Part Verified successfully');
    } catch (err) {
      console.error(err);
      addToast(errorMessage(err) || 'Failed to verify', 'error');
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!part) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      let newStatus = part.status;
      const counterKeys = Object.keys(part).filter(k => /box|seq/i.test(k));
      const verifierKeys = Object.keys(part).filter(k => /recount/i.test(k));
      const remarkKeys = Object.keys(part).filter(k => /remark|luqman/i.test(k));

      const boxTotal = calculateTotal(counterKeys);

      // Only write a key if this session actually touched it. formData only gets a
      // key for fields that were non-null at fetch time or that the user typed into -
      // a box another counter just filled in between this client's fetch and save
      // stays absent from formData (undefined), so it must never be written here or
      // it silently reverts to null and erases what the other counter just saved.
      const buildFieldUpdates = (keys: string[]) => {
        keys.forEach(k => {
          const current = formData[k];
          if (current === undefined) return; // never touched this session - leave alone
          if (current === '') {
            // explicitly cleared - only meaningful (and only reachable, since a
            // still-empty box is locked for non-Admins) if there was a value to clear
            if (part[k] !== null && part[k] !== undefined) updates[k] = null;
            return;
          }
          updates[k] = parseInt(current);
        });
      };

      if (user?.role?.startsWith('Counter B17') || user?.role?.startsWith('Counter B22') || user?.role === 'Admin') {
        buildFieldUpdates(counterKeys);
        if (boxTotal > 0 && (part.status === 'Not Counted' || part.status === 'Verified')) {
          newStatus = 'Counted';
        }
      }

      if (user?.role === 'Verifier' || user?.role === 'Admin') {
        buildFieldUpdates(verifierKeys);
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
      await commit(updates, 'Data saved successfully');
    } catch (err) {
      console.error(err);
      addToast(errorMessage(err) || 'Failed to save data', 'error');
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const zone = (table && ZONE_THEME[table]) || NEUTRAL_ZONE_THEME;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
      <Loader2 size={32} className="animate-spin" />
      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('loadingData')}</span>
    </div>
  );
  if (!part) return <EmptyState icon={<PackageX size={36} strokeWidth={1.5} />} message={t('noParts')} />;

  const counterKeys = Object.keys(part).filter(k => /box|seq/i.test(k)).sort();
  const verifierKeys = Object.keys(part).filter(k => /recount/i.test(k)).sort();
  const remarkKeys = Object.keys(part).filter(k => /remark|luqman/i.test(k)).sort();

  const getDisplayColumns = () => {
    const exclude = ['id', 'batch_id', 'status', '_table', 'no', 'verify_by', 'metadata', 'updated_at', 'updated_by']; // 'no' is displayed prominently at the top
    return Object.keys(part).filter(k => !exclude.includes(k) && !/box|seq|recount|remark|luqman/i.test(k));
  };
  const displayCols = getDisplayColumns();
  // The first descriptive column is the part's headline identifier.
  const headlineCol = displayCols.find(c => /part_?no|material/i.test(c)) || displayCols[0];
  const detailCols = displayCols.filter(c => c !== headlineCol);

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
  const showVerifier = verifierKeys.length > 0 && user?.role !== 'Counter B17' && user?.role !== 'Counter B22';

  const formatKeyName = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const boxTotalNow = calculateTotal(counterKeys);
  const recountKeysFilled = verifierKeys.filter(k => formData[k] && formData[k].trim() !== '');
  const lastRecount = recountKeysFilled.length ? parseInt(formData[recountKeysFilled[recountKeysFilled.length - 1]]) : null;

  const stepIndex = Math.max(0, STEPS.indexOf(part.status as typeof STEPS[number]));
  const statusLabel = (s: string) => s === 'Verified' ? t('verified') : s === 'Counted' ? t('counted') : t('notCounted');

  const canSave = canEditBox() || canEditRecount();
  const canVerify = canEditRecount() && part.status === 'Counted';

  const renderStepper = (key: string, locked: boolean, tone: 'box' | 'recount') => {
    const filled = !!formData[key];
    return (
      <div key={key} className="ct-stepper">
        <label htmlFor={`ct-${key}`} style={{ fontSize: '0.875rem', fontWeight: 700, color: filled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {formatKeyName(key)}
        </label>
        <button type="button" aria-label={`Decrease ${formatKeyName(key)}`} disabled={locked || !filled} onClick={() => stepValue(key, -1)}>
          <Minus size={20} strokeWidth={2.5} />
        </button>
        <input
          id={`ct-${key}`}
          type="number"
          inputMode="numeric"
          min={0}
          className={`ct-qty mono ${filled ? (tone === 'box' ? 'filled' : 'recount') : 'next'}`}
          value={formData[key] || ''}
          placeholder="—"
          onChange={(e) => handleInputChange(key, e.target.value)}
          disabled={locked}
        />
        <button type="button" aria-label={`Increase ${formatKeyName(key)}`} disabled={locked} onClick={() => stepValue(key, 1)}>
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .ct-label-card { background: #fff; border: 2px solid var(--primary-color); border-radius: var(--radius-lg); padding: 1.125rem 1.125rem 0.375rem; margin-top: 0.25rem; }
        .ct-barcode {
          height: 38px; margin-top: 0.875rem;
          background: repeating-linear-gradient(90deg, var(--primary-color) 0 2px, transparent 2px 4px, var(--primary-color) 4px 5px, transparent 5px 8px, var(--primary-color) 8px 11px, transparent 11px 12px, var(--primary-color) 12px 13px, transparent 13px 16px);
        }
        .ct-kv { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 1rem; margin-top: 0.5rem; border-top: 1.5px dashed var(--border-strong); }
        .ct-kv > div { display: flex; flex-direction: column; gap: 2px; padding: 0.75rem 0; border-bottom: 1px solid var(--bg-color); min-width: 0; }
        .ct-kv .k { font-size: 0.625rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-secondary); }
        .ct-kv .v { font-size: 0.9375rem; font-weight: 700; overflow-wrap: anywhere; }
        .ct-steps { list-style: none; margin: 1.125rem 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .ct-steps li { display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-align: center; }
        .ct-steps li .dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.875rem; z-index: 1; background: #fff; border: 2px solid #C9C5B9; color: var(--text-secondary); }
        .ct-steps li.done .dot { background: var(--primary-color); border-color: var(--primary-color); color: #fff; }
        .ct-steps li.current { color: var(--text-primary); font-weight: 800; }
        .ct-steps li.current .dot { background: var(--signal-color); border-color: var(--signal-color); color: var(--primary-color); box-shadow: 0 0 0 5px rgba(255,184,0,0.25); }
        .ct-steps li.current.final .dot { background: var(--success-color); border-color: var(--success-color); color: #fff; box-shadow: 0 0 0 5px rgba(15,123,69,0.2); }
        .ct-steps li:not(:last-child)::after { content: ''; position: absolute; top: 15px; left: 50%; width: 100%; height: 3px; background: var(--border-color); }
        .ct-steps li.done:not(:last-child)::after { background: var(--primary-color); }
        .ct-card { padding: 1.125rem; margin-top: 0.75rem; }
        .ct-card h2 { margin: 0; font-size: 1.0625rem; }
        .ct-stepper { display: grid; grid-template-columns: 76px 52px minmax(0, 1fr) 52px; align-items: center; gap: 0.5rem; animation: fade-in 0.25s ease-out; }
        .ct-stepper button {
          height: 52px; border-radius: var(--radius-md); border: 1.5px solid var(--border-color); background: #fff;
          color: var(--primary-color); display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .ct-stepper button:disabled { opacity: 0.35; cursor: not-allowed; }
        .ct-qty {
          height: 52px; width: 100%; border-radius: var(--radius-md); border: 1.5px solid var(--border-strong);
          background: #fff; text-align: center; font-size: 1.375rem; font-weight: 700; color: var(--primary-color); outline: none;
          -moz-appearance: textfield;
        }
        .ct-qty::-webkit-outer-spin-button, .ct-qty::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .ct-qty.filled { border-color: var(--success-color); background: var(--success-bg); color: var(--success-text); }
        .ct-qty.recount { border-color: var(--primary-color); }
        .ct-qty.next { border-style: dashed; border-color: #8A8F99; background: #FAF9F6; }
        .ct-qty:disabled { cursor: not-allowed; }
        .ct-qty.next:disabled { background: var(--surface-highlight); }
        .ct-actions {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
          background: #fff; border-top: 1px solid var(--border-color);
          padding: 0.875rem 1rem calc(0.875rem + env(safe-area-inset-bottom));
        }
        .ct-actions-inner { max-width: 640px; margin: 0 auto; display: flex; gap: 0.625rem; }
        .ct-actions-inner .ds-btn { flex: 1; }
      `}</style>

      <Navigation
        title={t('itemDetails')}
        backTo={`/stock-take/list?table=${table}`}
        titleAccessory={<span className="ds-chip" style={{ background: zone.accent, color: '#fff' }}>{zone.code}</span>}
      />

      <main className="ds-page narrow" style={{ flex: 1, paddingBottom: canSave ? 'calc(120px + env(safe-area-inset-bottom))' : '2rem' }}>

        {/* Part label */}
        <section className="ct-label-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            <span className="eyebrow">{headlineCol ? formatKeyName(headlineCol) : 'Part'}</span>
            <span className="mono" style={{ fontSize: '0.8125rem', fontWeight: 700 }}>No. {displayNo || part.no || '—'}</span>
          </div>
          <div className="mono" style={{ fontSize: 'clamp(1.5rem, 8vw, 2rem)', fontWeight: 700, letterSpacing: '-0.02em', marginTop: '0.25rem', overflowWrap: 'anywhere' }}>
            {(headlineCol && part[headlineCol]) || part.id}
          </div>
          <div className="ct-barcode" aria-hidden="true" />
          {detailCols.length > 0 && (
            <div className="ct-kv">
              {detailCols.map(col => (
                <div key={col}>
                  <span className="k">{col.replace(/_/g, ' ')}</span>
                  <span className="v">{part[col] || '—'}</span>
                </div>
              ))}
              <div>
                <span className="k">{t('verifiedBy')}</span>
                <span className="v">{part.verify_by || '—'}</span>
              </div>
              {part.updated_at && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="k">{t('lastUpdate')}</span>
                  <span className="v">
                    <span className="mono">{new Date(part.updated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })}</span>
                    {part.updated_by && <> · {part.updated_by}</>}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Status */}
        <ol className="ct-steps" aria-label={t('status')}>
          {STEPS.map((s, i) => {
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'current' : '';
            return (
              <li key={s} className={`${state}${i === STEPS.length - 1 ? ' final' : ''}`} aria-current={i === stepIndex ? 'step' : undefined}>
                <span className="dot">{i < stepIndex || (i === stepIndex && i === STEPS.length - 1) ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                {statusLabel(s)}
              </li>
            );
          })}
        </ol>

        {/* Box count */}
        {counterKeys.length > 0 && (
          <section className="ds-card ct-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem' }}>
              <div>
                <h2>{t('countData')}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{t('nextBoxHint')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('total')}</div>
                <div className="mono" style={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 1 }}>{boxTotalNow}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '1rem' }}>
              {visibleCounterKeys.map(key => renderStepper(key, isBoxLocked(key), 'box'))}
            </div>
          </section>
        )}

        {/* Recount */}
        {showVerifier && (
          <section className="ds-card ct-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <h2>{t('recount')}</h2>
              <span className="ds-chip" style={{ background: '#E5ECFF', color: '#1F3A8A' }}>{t('verifierOnly')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.875rem' }}>
              {visibleVerifierKeys.map(key => renderStepper(key, !canEditRecount(), 'recount'))}
            </div>
            {lastRecount !== null && counterKeys.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.8125rem', fontWeight: 700, color: lastRecount === boxTotalNow ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {lastRecount === boxTotalNow
                  ? <><Check size={18} strokeWidth={2.5} /> {tf('matchesBoxTotal', { n: boxTotalNow })}</>
                  : <>{tf('differsBoxTotal', { n: boxTotalNow })}</>}
              </div>
            )}
          </section>
        )}

        {/* Remarks */}
        {remarkKeys.map(key => (
          <section key={key} className="ds-card ct-card">
            <label htmlFor={`ct-${key}`} style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 800 }}>{formatKeyName(key)}</label>
            {part[key] && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', fontSize: '0.8125rem', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {String(part[key]).split(' | ').map((r: string, i: number) => <div key={i}>{r}</div>)}
              </div>
            )}
            <textarea
              id={`ct-${key}`}
              className="ds-fld"
              rows={2}
              value={formData[key] || ''}
              onChange={(e) => handleInputChange(key, e.target.value)}
              disabled={!canSave}
              placeholder={t('addRemarkPlaceholder')}
              style={{ marginTop: '0.625rem' }}
            />
          </section>
        ))}
      </main>

      {canSave && (
        <div className="ct-actions">
          <div className="ct-actions-inner">
            {isDirty ? (
              <>
                <button type="button" className="ds-btn quiet lg" onClick={handleReset} disabled={saving} style={{ flex: '0 1 34%' }}>
                  {t('cancel')}
                </button>
                <button type="button" className="ds-btn signal lg" onClick={handleSave} disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </button>
              </>
            ) : canVerify ? (
              <button type="button" className="ds-btn go lg" onClick={handleVerify} disabled={saving}>
                <ShieldCheck size={20} /> {saving ? '...' : t('verifyNow')}
              </button>
            ) : (
              <button type="button" className="ds-btn quiet lg" disabled>
                {part.status === 'Verified' ? <><Check size={20} /> {t('verified')}</> : t('enterCountToSave')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
