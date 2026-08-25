import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from '../../components/Navigation';
import { Card } from '../../components/ui/Card';
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
      <BackgroundDecor />
      <Navigation title="User Management" backTo={-1} />

      <main style={{ flex: 1, padding: '2rem 1rem 6rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px' }}>
          <Card style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%)', borderRadius: '50%', color: 'white', boxShadow: '0 10px 15px -3px rgba(0,30,80,0.3)', flexShrink: 0 }}>
                  <UsersIcon size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>User Management</h2>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>Create operator accounts, reset passwords, deactivate resigned staff.</p>
                </div>
              </div>
              <Button onClick={() => setShowAddModal(true)} style={{ backgroundColor: 'var(--primary-color)', color: 'white', flexShrink: 0 }}>
                <UserPlus size={16} /> Add Operator
              </Button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <Input
                placeholder="Search by ID, name, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search size={16} />}
              />
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[1, 2, 3, 4].map(i => <Skeleton key={i} height="3.5rem" />)}
              </div>
            ) : filteredUsers.length === 0 ? (
              <EmptyState icon={<UsersIcon size={40} strokeWidth={1.5} />} message={search ? 'No users match your search.' : 'No users found.'} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredUsers.map((u) => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                    padding: '1rem 1.25rem', borderRadius: 'var(--radius-card)',
                    backgroundColor: u.is_active ? 'rgba(248, 250, 252, 0.8)' : 'rgba(254, 242, 242, 0.6)',
                    border: `1px solid ${u.is_active ? 'rgba(226, 232, 240, 0.8)' : 'rgba(254, 202, 202, 0.8)'}`,
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{u.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({u.id})</span>
                        {!u.is_active && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--danger-color)', textTransform: 'uppercase', backgroundColor: '#fee2e2', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}>
                            Deactivated
                          </span>
                        )}
                        {u.is_active && u.must_change_password && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', backgroundColor: '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)' }}>
                            Pending first login
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600, marginTop: '0.15rem' }}>{u.role}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <Button
                        variant="secondary"
                        disabled={processingId === u.id}
                        onClick={() => setConfirmTarget({ id: u.id, name: u.name, action: 'reset' })}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', minHeight: '44px' }}
                      >
                        <KeyRound size={14} /> Reset
                      </Button>
                      {u.is_active ? (
                        <Button
                          variant="danger"
                          disabled={processingId === u.id || u.id === currentUser?.id}
                          onClick={() => setConfirmTarget({ id: u.id, name: u.name, action: 'deactivate' })}
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', minHeight: '44px' }}
                          title={u.id === currentUser?.id ? "You can't deactivate your own account" : undefined}
                        >
                          <Ban size={14} /> Deactivate
                        </Button>
                      ) : (
                        <Button
                          disabled={processingId === u.id}
                          onClick={() => handleSetActive(u.id, true)}
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', minHeight: '44px', backgroundColor: 'var(--success-color)', color: 'white' }}
                        >
                          <CheckCircle2 size={14} /> Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Add Operator modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '420px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '420px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', textAlign: 'center' }}>
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
