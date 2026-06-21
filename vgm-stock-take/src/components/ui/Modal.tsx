import React from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Align content to bottom (iOS sheet style) */
  sheet?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, children, sheet = false }) => {
  if (!open) return null;

  return (
    <div 
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={sheet ? { alignItems: 'flex-end' } : undefined}
    >
      <div className={`modal-content ${sheet ? 'modal-sheet' : ''}`}>
        {children}
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open, onClose, onConfirm, title, message,
  confirmText = 'Confirm', cancelText = 'Cancel',
  variant = 'danger'
}) => {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <h3 style={{ color: variant === 'danger' ? 'var(--color-danger)' : 'var(--brand-primary)' }}>
        {title}
      </h3>
      <p>{message}</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          {cancelText}
        </button>
        <button 
          className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};
