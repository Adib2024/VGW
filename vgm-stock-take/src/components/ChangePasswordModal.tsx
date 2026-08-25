import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

// Self-service password change for the currently logged-in user, opened from
// Navigation's profile menu. Separate from ForcedPasswordChange, which is
// the full-screen, non-dismissible flow shown when must_change_password is
// still set (e.g. first login, or after an Admin reset).
export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose }) => {
  const { changePassword } = useAuth();
  const { addToast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    onClose();
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
  };

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

    setSubmitting(true);
    try {
      const result = await changePassword(newPassword);
      if (!result.success) {
        setErrorMsg(result.error || 'Failed to update password.');
        return;
      }
      addToast('Password updated', 'success');
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '380px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 1.25rem 0', color: 'var(--primary-color)', fontSize: '1.25rem', fontWeight: 800 }}>Change Password</h3>
        <form onSubmit={handleSubmit} className="flex-col gap-4">
          {errorMsg && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: '#fef2f2', color: 'var(--danger-text)', border: '1px solid #fecaca', fontSize: '0.85rem', fontWeight: 500 }}>
              {errorMsg}
            </div>
          )}
          <Input
            label="New Password"
            type={showPasswordText ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            icon={<Lock size={16} />}
            rightElement={(
              <button type="button" onClick={() => setShowPasswordText(!showPasswordText)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}>
                {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          />
          <Input
            label="Confirm Password"
            type={showPasswordText ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            icon={<Lock size={16} />}
          />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <Button type="button" variant="secondary" onClick={handleClose} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} style={{ flex: 1 }}>
              {submitting ? '...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
