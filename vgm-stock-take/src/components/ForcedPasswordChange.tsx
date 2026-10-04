import React, { useState } from 'react';
import { errorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Input } from './ui/Input';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

// Shown by ProtectedRoute for any authenticated user whose profile still has
// must_change_password set (e.g. everyone migrated with a temporary password).
// Renders in place of whatever route was requested, so it can't be bypassed
// by navigating directly to another URL.
export const ForcedPasswordChange: React.FC = () => {
  const { refreshUser, logout } = useAuth();
  const { addToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      const { error: rpcError } = await supabase.rpc('clear_must_change_password');
      if (rpcError) throw rpcError;

      addToast('Password updated', 'success');
      await refreshUser();
    } catch (err) {
      // Shown inline (not just a toast) - this screen has no other content,
      // so a failure here otherwise looks like the app silently hung.
      setErrorMsg(errorMessage(err) || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--primary-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ color: '#fff', padding: '0 0.5rem 1.5rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--signal-color)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ color: '#fff', margin: '1rem 0 0', fontSize: '2rem' }}>Set a new password</h1>
          <p style={{ color: 'var(--text-on-dark)', margin: '0.375rem 0 0', fontSize: '0.9375rem' }}>Required before you can continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="ds-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {errorMsg && <div className="ds-banner bad">{errorMsg}</div>}

          <Input
            label="New password"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            rightElement={(
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            )}
          />

          <Input
            label="Confirm password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <button type="submit" className="ds-btn signal lg block" disabled={loading} style={{ marginTop: '0.25rem' }}>
            {loading ? '...' : 'Set password'}
          </button>

          <button
            type="button"
            onClick={() => logout()}
            style={{ minHeight: 44, background: 'none', border: 'none', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Log out instead
          </button>
        </form>
      </div>
    </div>
  );
};
