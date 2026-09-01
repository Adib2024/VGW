import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from '../../components/Navigation';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { BackgroundDecor } from '../../components/ui/BackgroundDecor';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { BottomNav } from '../../components/ui/BottomNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UserPlus, KeyRound, Ban, CheckCircle2, Copy, Users as UsersIcon, Search } from 'lucide-react';

const ROLES = ['Counter B17', 'Counter B22', 'Verifier', 'Operator Batt', 'QA Inspector', 'Admin'];

interface UserRow {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
}

interface TempPasswordResult {
  id: string;
  name: string;
  role: string;
  tempPassword: string;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const isMounted = useRef(true);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addId, setAddId] = useState('');
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState(ROLES[0]);
  const [addError, setAddError] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; action: 'reset' | 'deactivate' } | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<TempPasswordResult | null>(null);

  useEffect(() => {
    isMounted.current = true;
    fetchUsers();
    return () => { isMounted.current = false; };
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role, is_active, must_change_password')
      .order('id');
    if (isMounted.current) {
      if (!error && data) setUsers(data as UserRow[]);
      setLoading(false);
    }
  };

  const callAdminApi = async (path: string, body: unknown) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('No active session. Please log in again.');

    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSubmitting(true);
    try {
      const result = await callAdminApi('/api/admin/create-user', { id: addId, name: addName, role: addRole });
      setShowAddModal(false);
      setAddId('');
      setAddName('');
      setAddRole(ROLES[0]);
      setTempPasswordResult(result);
      fetchUsers();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create operator.');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (processingId) return; // guard against a rapid double-click firing this twice
    setConfirmTarget(null);
    setProcessingId(id);
    try {
      const result = await callAdminApi('/api/admin/reset-password', { id });
      const target = users.find(u => u.id === id);
      setTempPasswordResult({ id, name: target?.name || id, role: target?.role || '', tempPassword: result.tempPassword });
    } catch (err: any) {
      addToast(err.message || 'Failed to reset password.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSetActive = async (id: string, active: boolean) => {
    if (processingId) return; // guard against a rapid double-click firing this twice
    setConfirmTarget(null);
    setProcessingId(id);
    try {
      await callAdminApi('/api/admin/set-active', { id, active });
      addToast(active ? 'Account reactivated.' : 'Account deactivated.', 'success');
      fetchUsers();
    } catch (err: any) {
      addToast(err.message || 'Failed to update account status.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copied to clipboard.', 'success');
  };

  const filteredUsers = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.id.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .au-panel {
          position: relative;
          background: var(--surface-color);
          border-radius: var(--radius-panel);
          box-shadow: 0 10px 30px -8px rgba(var(--primary-color-rgb), 0.12), 0 2px 8px -2px rgba(var(--primary-color-rgb), 0.05);
          overflow: hidden;
        }
        .au-panel::before, .au-panel::after { content: ''; position: absolute; width: 14px; height: 14px; opacity: 0.5; }
        .au-panel::before { top: 10px; left: 10px; border-top: 2px solid var(--primary-color); border-left: 2px solid var(--primary-color); border-radius: 3px 0 0 0; }
        .au-panel::after { bottom: 10px; right: 10px; border-bottom: 2px solid var(--primary-color); border-right: 2px solid var(--primary-color); border-radius: 0 0 3px 0; }

        .au-top { padding: 1.5rem 1.6rem 1.25rem; display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: center; justify-content: space-between; }
        .au-id { display: flex; align-items: center; gap: 0.9rem; }
        .au-id-icon {
          width: 46px; height: 46px; border-radius: var(--radius-card); flex-shrink: 0;
          background: rgba(var(--primary-color-rgb), 0.08); box-shadow: inset 0 0 0 1.5px var(--primary-color);
          display: flex; align-items: center; justify-content: center; color: var(--primary-color);
        }
        .au-id h1 { font-size: 1.1rem; font-weight: 700; color: var(--primary-color); margin: 0; }
        .au-id .au-sub { font-size: 0.78rem; color: var(--text-secondary); font-weight: 500; margin-top: 0.15rem; }

        .au-search { padding: 0 1.6rem 1.4rem; }

        .au-roster { border-top: 1px solid var(--surface-highlight); }
        .au-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.1rem 1.6rem; border-bottom: 1px solid #f8fafc; flex-wrap: wrap; }
        .au-row:last-child { border-bottom: none; }
        .au-row.inactive { background: rgba(254, 242, 242, 0.4); }
        .au-row-id { display: flex; align-items: center; gap: 1rem; min-width: 0; flex: 1 1 260px; }
        .au-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-color); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem; flex-shrink: 0; }
        .au-row.inactive .au-avatar { background: #94a3b8; }
        .au-row-name { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .au-row-name .n { font-weight: 700; color: var(--text-primary); }
        .au-row-name .id { font-size: 0.75rem; color: #94a3b8; }
        .au-row-role { font-size: 0.78rem; color: var(--primary-color); font-weight: 700; margin-top: 0.15rem; }
        .au-tag { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.18rem 0.55rem; border-radius: var(--radius-full); }
        .au-tag.bad { background: var(--danger-bg); color: var(--danger-text); }
        .au-tag.warn { background: var(--warning-bg); color: var(--warning-text); }

        .au-row-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
        .au-act-btn { display: flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.85rem; border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 700; cursor: pointer; border: 1px solid transparent; min-height: 44px; font-family: inherit; }
        .au-act-btn.ghost { background: var(--surface-color); border-color: var(--border-color); border-color: #e2e8f0; color: var(--text-primary); }
        .au-act-btn.danger { background: var(--danger-bg); color: var(--danger-text); }
        .au-act-btn.ok { background: var(--success-color); color: #fff; }
        .au-act-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .au-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .au-modal { background: var(--surface-color); padding: 2rem; border-radius: var(--radius-panel); max-width: 420px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
      `}</style>
      <BackgroundDecor />
      <Navigation title="User Management" backTo={-1} />

      <main style={{ flex: 1, padding: '1.5rem 1rem 6rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px' }}>
          <div className="au-panel">
            <div className="au-top">
              <div className="au-id">
                <div className="au-id-icon"><UsersIcon size={22} /></div>
                <div>
                  <h1>Operator Roster</h1>
                  <div className="au-sub">Create accounts, reset passwords, deactivate resigned staff</div>
                </div>
              </div>
              <Button onClick={() => setShowAddModal(true)}>
                <UserPlus size={16} /> Add Operator
              </Button>
            </div>

            <div className="au-search">
              <Input
                placeholder="Search by ID, name, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search size={16} />}
              />
            </div>

            <div className="au-roster">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0 1.6rem 1.6rem' }}>
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} height="3.5rem" />)}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: '0 1.6rem 1.6rem' }}>
                  <EmptyState icon={<UsersIcon size={40} strokeWidth={1.5} />} message={search ? 'No users match your search.' : 'No users found.'} />
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div key={u.id} className={`au-row ${u.is_active ? '' : 'inactive'}`}>
                    <div className="au-row-id">
                      <div className="au-avatar">{u.name?.charAt(0).toUpperCase() || u.id.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="au-row-name">
                          <span className="n">{u.name}</span>
                          <span className="id">({u.id})</span>
                          {!u.is_active && <span className="au-tag bad">Deactivated</span>}
                          {u.is_active && u.must_change_password && <span className="au-tag warn">Pending first login</span>}
                        </div>
                        <div className="au-row-role">{u.role}</div>
                      </div>
                    </div>

                    <div className="au-row-actions">
                      <button
                        className="au-act-btn ghost"
                        disabled={processingId === u.id}
                        onClick={() => setConfirmTarget({ id: u.id, name: u.name, action: 'reset' })}
                      >
                        <KeyRound size={14} /> Reset
                      </button>
                      {u.is_active ? (
                        <button
                          className="au-act-btn danger"
                          disabled={processingId === u.id || u.id === currentUser?.id}
                          onClick={() => setConfirmTarget({ id: u.id, name: u.name, action: 'deactivate' })}
                          title={u.id === currentUser?.id ? "You can't deactivate your own account" : undefined}
                        >
                          <Ban size={14} /> Deactivate
                        </button>
                      ) : (
                        <button
                          className="au-act-btn ok"
                          disabled={processingId === u.id}
                          onClick={() => handleSetActive(u.id, true)}
                        >
                          <CheckCircle2 size={14} /> Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add Operator modal */}
      {showAddModal && (
        <div className="au-modal-overlay">
          <div className="au-modal">
            <h3 style={{ margin: '0 0 1.25rem 0', color: 'var(--primary-color)', fontSize: '1.25rem', fontWeight: 800 }}>Add Operator</h3>
            <form onSubmit={handleAddUser} className="flex-col gap-4">
              {addError && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: '#fef2f2', color: 'var(--danger-text)', border: '1px solid #fecaca', fontSize: '0.85rem', fontWeight: 500 }}>
                  {addError}
                </div>
              )}
              <Input label="User ID" value={addId} onChange={(e) => setAddId(e.target.value)} required placeholder="e.g. OperB17_16" />
              <Input label="Name" value={addName} onChange={(e) => setAddName(e.target.value)} required placeholder="e.g. Operator B17-16" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Role</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#334155', outline: 'none', fontSize: '1rem', cursor: 'pointer' }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <Button type="button" variant="secondary" onClick={() => { setShowAddModal(false); setAddError(''); }} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addSubmitting} style={{ flex: 1 }}>
                  {addSubmitting ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-time temp password display */}
      {tempPasswordResult && (
        <div className="au-modal-overlay">
          <div className="au-modal" style={{ textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)', fontSize: '1.25rem', fontWeight: 800 }}>
              {tempPasswordResult.name}'s Temporary Password
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', color: '#b45309', fontSize: '0.8rem', fontWeight: 600 }}>
              Note this down now — it will not be shown again. Hand it to {tempPasswordResult.name} ({tempPasswordResult.id}); they'll be required to set their own password on first login.
            </p>
            <div
              onClick={() => copyToClipboard(tempPasswordResult.tempPassword)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: '#f1f5f9', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', marginBottom: '1.5rem', userSelect: 'all' }}
              title="Click to copy"
            >
              {tempPasswordResult.tempPassword} <Copy size={16} color="#64748b" />
            </div>
            <Button fullWidth onClick={() => setTempPasswordResult(null)}>
              Done, I've saved it
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget?.action === 'reset' ? 'Reset Password' : 'Deactivate Account'}
        message={
          confirmTarget?.action === 'reset'
            ? <>Generate a new temporary password for <strong>{confirmTarget?.name}</strong>? Their current password will stop working immediately.</>
            : <>Deactivate <strong>{confirmTarget?.name}</strong>'s account? They will be unable to log in until reactivated.</>
        }
        confirmLabel={confirmTarget?.action === 'reset' ? 'Reset Password' : 'Deactivate'}
        cancelLabel="Cancel"
        variant="danger"
        loading={!!confirmTarget && processingId === confirmTarget.id}
        onConfirm={() => {
          if (!confirmTarget) return;
          if (confirmTarget.action === 'reset') handleResetPassword(confirmTarget.id);
          else handleSetActive(confirmTarget.id, false);
        }}
        onCancel={() => setConfirmTarget(null)}
      />

      <BottomNav />
    </div>
  );
}
