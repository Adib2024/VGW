import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Input } from './ui/Input';
import { Eye, EyeOff } from 'lucide-react';

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
    <div className="ds-overlay" role="dialog" aria-modal="true" aria-labelledby="change-pw-title">
      <div className="ds-modal">
        <h3 id="change-pw-title">Change password</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {errorMsg && <div className="ds-banner bad">{errorMsg}</div>}
          <Input
            label="New password"
            type={showPasswordText ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            rightElement={(
              <button type="button" onClick={() => setShowPasswordText(!showPasswordText)} aria-label={showPasswordText ? 'Hide password' : 'Show password'} style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showPasswordText ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            )}
          />
          <Input
            label="Confirm password"
            type={showPasswordText ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.625rem', marginTop: '0.25rem' }}>
            <button type="button" className="ds-btn quiet" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="ds-btn signal" disabled={submitting}>
              {submitting ? '...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
