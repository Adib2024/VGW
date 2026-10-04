import React, { useState, useEffect, useRef } from 'react';
import { errorMessage } from '../../lib/errors';
import { Navigation } from '../../components/Navigation';
import { AdminTabs } from '../../components/AdminTabs';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { BottomNav } from '../../components/ui/BottomNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UserPlus, KeyRound, Copy, Users as UsersIcon, Search } from 'lucide-react';

const ROLES = ['Counter B17', 'Counter B22', 'Verifier', 'Operator Batt', 'QA Inspector', 'Admin'];

// Avatar / role-chip colors per role [background, text]
const ROLE_COLORS: Record<string, [string, string]> = {
  'Counter B17': ['#E5ECFF', '#1F3A8A'],
  'Counter B22': ['#FDE4E8', '#8C1328'],
  'Verifier': ['#DDF3EA', '#075E42'],
  'Operator Batt': ['#E3F1EC', '#0B5A41'],
  'QA Inspector': ['#FFF0D1', '#7A4500'],
  'Admin': ['#0B1B3A', '#FFFFFF'],
};

const initials = (name: string, id: string) => {
  const parts = (name || id).split(/[\s\-_]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

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
  const [roleFilter, setRoleFilter] = useState('all');

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
    } catch (err) {
      setAddError(errorMessage(err) || 'Failed to create operator.');
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
    } catch (err) {
      addToast(errorMessage(err) || 'Failed to reset password.', 'error');
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
    } catch (err) {
      addToast(errorMessage(err) || 'Failed to update account status.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copied to clipboard.', 'success');
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.id.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const activeCount = users.filter(u => u.is_active).length;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .au-list { list-style: none; margin: 0; padding: 0.25rem 1rem; }
        .au-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--bg-color); }
        .au-row:last-child { border-bottom: 0; }
        .au-row.inactive .au-who { opacity: 0.55; }
        .au-avatar { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8125rem; font-weight: 800; flex-shrink: 0; }
        .au-name { font-size: 0.9375rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .au-switch { display: flex; align-items: center; justify-content: center; min-width: 52px; min-height: 44px; cursor: pointer; }
      `}</style>
      <Navigation title="User Management" backTo={-1} />

      <main className="ds-page narrow with-nav" style={{ flex: 1 }}>
        <AdminTabs />

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', margin: '1.25rem 0.25rem 0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Operator roster</h2>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{users.length}</span> users · <span className="mono">{activeCount}</span> active
            </div>
          </div>
          <button type="button" className="ds-btn signal sm" onClick={() => setShowAddModal(true)}>
            <UserPlus size={18} /> Add
          </button>
        </div>

        <div className="ds-search" style={{ marginTop: '1rem' }}>
          <label htmlFor="au-search" className="sr-only">Search users</label>
          <Search size={20} />
          <input id="au-search" className="ds-fld" type="search" placeholder="Search by ID, name or role" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="ds-filters" role="group" aria-label="Filter by role" style={{ marginTop: '0.75rem' }}>
          {['all', ...ROLES].map(r => (
            <button key={r} type="button" className={`ds-filt ${roleFilter === r ? 'on' : ''}`} aria-pressed={roleFilter === r} onClick={() => setRoleFilter(r)}>
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>

        <section className="ds-card" style={{ marginTop: '1rem' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
              {[1, 2, 3, 4].map(i => <Skeleton key={i} height="3rem" />)}
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState icon={<UsersIcon size={36} strokeWidth={1.5} />} message={search || roleFilter !== 'all' ? 'No users match your search.' : 'No users found.'} />
          ) : (
            <ul className="au-list">
              {filteredUsers.map((u) => {
                const [bg, fg] = ROLE_COLORS[u.role] || ['#F1EFE9', '#4A5468'];
                const isSelf = u.id === currentUser?.id;
                const busy = processingId === u.id;
                return (
                  <li key={u.id} className={`au-row ${u.is_active ? '' : 'inactive'}`}>
                    <div className="au-who" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                      <div className="au-avatar" style={{ background: bg, color: fg }}>{initials(u.name, u.id)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="au-name">{u.name}</div>
                        <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.id}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                          <span className="ds-chip" style={{ background: bg, color: fg, height: 22, fontSize: '0.625rem' }}>{u.role}</span>
                          {!u.is_active && <span className="ds-chip danger" style={{ height: 22, fontSize: '0.625rem' }}>Deactivated</span>}
                          {u.is_active && u.must_change_password && <span className="ds-chip warn" style={{ height: 22, fontSize: '0.625rem' }}>Pending first login</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ds-iconbtn ghost"
                      aria-label={`Reset password for ${u.name}`}
                      title="Reset password"
                      disabled={busy}
                      onClick={() => setConfirmTarget({ id: u.id, name: u.name, action: 'reset' })}
                    >
                      <KeyRound size={18} />
                    </button>
                    <label className="au-switch" title={isSelf ? "You can't deactivate your own account" : u.is_active ? 'Active' : 'Deactivated'}>
                      <input
                        type="checkbox"
                        className="ds-switch"
                        aria-label={`${u.name} active`}
                        checked={u.is_active}
                        disabled={busy || (isSelf && u.is_active)}
                        onChange={() => {
                          if (u.is_active) setConfirmTarget({ id: u.id, name: u.name, action: 'deactivate' });
                          else handleSetActive(u.id, true);
                        }}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {/* Add Operator modal */}
      {showAddModal && (
        <div className="ds-overlay" role="dialog" aria-modal="true" aria-labelledby="au-add-title">
          <div className="ds-modal">
            <h3 id="au-add-title">Add operator</h3>
            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {addError && <div className="ds-banner bad">{addError}</div>}
              <Input label="User ID" className="mono" value={addId} onChange={(e) => setAddId(e.target.value)} required placeholder="e.g. OperB17_16" />
              <Input label="Name" value={addName} onChange={(e) => setAddName(e.target.value)} required placeholder="e.g. Operator B17-16" />
              <div>
                <label htmlFor="au-role" className="ds-label">Role</label>
                <select id="au-role" className="ds-fld" value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.625rem', marginTop: '0.25rem' }}>
                <button type="button" className="ds-btn quiet" onClick={() => { setShowAddModal(false); setAddError(''); }}>
                  Cancel
                </button>
                <button type="submit" className="ds-btn signal" disabled={addSubmitting}>
                  {addSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-time temp password display */}
      {tempPasswordResult && (
        <div className="ds-overlay" role="dialog" aria-modal="true" aria-labelledby="au-temp-title">
          <div className="ds-modal" style={{ textAlign: 'center' }}>
            <h3 id="au-temp-title">{tempPasswordResult.name}'s temporary password</h3>
            <p style={{ margin: '0 0 1.25rem', color: 'var(--warning-text)', fontSize: '0.8125rem', fontWeight: 600 }}>
              Note this down now — it will not be shown again. Hand it to {tempPasswordResult.name} ({tempPasswordResult.id}); they'll be required to set their own password on first login.
            </p>
            <button
              type="button"
              onClick={() => copyToClipboard(tempPasswordResult.tempPassword)}
              className="mono"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--surface-sunken)', border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '1.25rem', userSelect: 'all' }}
              title="Click to copy"
            >
              {tempPasswordResult.tempPassword} <Copy size={16} color="var(--text-secondary)" />
            </button>
            <button type="button" className="ds-btn ink block" onClick={() => setTempPasswordResult(null)}>
              Done, I've saved it
            </button>
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
