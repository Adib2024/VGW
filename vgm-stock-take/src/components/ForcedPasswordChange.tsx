import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { BackgroundDecor } from './ui/BackgroundDecor';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

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
    } catch (err: any) {
      // Shown inline (not just a toast) - this screen has no other content,
      // so a failure here otherwise looks like the app silently hung.
      setErrorMsg(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center" style={{ minHeight: '100vh', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
      <BackgroundDecor />

      <div style={{ width: '100%', maxWidth: '400px', zIndex: 10, padding: '0 1rem' }}>
        <Card className="w-full" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-card)', backgroundColor: '#ffffff', boxShadow: '0 20px 50px rgba(0,30,80,0.18)' }}>

          <div style={{
            background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%)',
            padding: '2rem 2rem 3rem',
            textAlign: 'center',
            position: 'relative'
          }}>
            <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Set a New Password</h2>
            <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', fontWeight: 500 }}>
              Required before you can continue
            </p>

            <div style={{
              position: 'absolute',
              bottom: '-40px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(0,30,80,0.3)'
            }}>
              <ShieldCheck size={40} color="var(--primary-color)" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex-col gap-4" style={{ width: '100%', padding: '3.5rem 2rem 2rem' }}>
            {errorMsg && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fef2f2',
                color: 'var(--danger-text)',
                border: '1px solid #fecaca',
                fontSize: '0.85rem',
                fontWeight: 500
              }}>
                {errorMsg}
              </div>
            )}

            <Input
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              icon={<Lock size={16} />}
              rightElement={(
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            />

            <Input
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              icon={<Lock size={16} />}
            />

            <Button
              type="submit"
              fullWidth
              style={{ marginTop: '1rem', background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%)', borderRadius: 'var(--radius-md)', padding: '0.875rem', boxShadow: '0 8px 20px rgba(0,30,80,0.25)' }}
              disabled={loading}
            >
              {loading ? '...' : 'Set Password'}
            </Button>

            <button
              type="button"
              onClick={() => logout()}
              style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#888', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', width: '100%' }}
            >
              Log out instead
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
};
