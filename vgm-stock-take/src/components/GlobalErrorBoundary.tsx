import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { RefreshCw, AlertTriangle } from 'lucide-react';

function ErrorFallback({ error, resetErrorBoundary }: { error: any, resetErrorBoundary: () => void }) {
  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0f172a',
      color: '#ffffff',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <AlertTriangle size={64} color="var(--danger-color)" style={{ marginBottom: '1.5rem' }} />
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Something went wrong</h1>
      <p style={{ color: '#94a3b8', marginBottom: '2rem', maxWidth: '400px' }}>
        The application encountered an unexpected error. This might be due to a temporary network issue or a hardware feature failing.
      </p>
      
      <div style={{ 
        backgroundColor: '#1e293b', 
        padding: '1rem', 
        borderRadius: '8px',
        marginBottom: '2rem',
        maxWidth: '500px',
        width: '100%',
        overflowX: 'auto',
        fontSize: '0.875rem',
        color: '#f87171',
        textAlign: 'left'
      }}>
        <code>{error.message}</code>
      </div>

      <button 
        onClick={resetErrorBoundary}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        <RefreshCw size={20} />
        Reload Application
      </button>
    </div>
  );
}

export const GlobalErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset the state of your app so the error doesn't happen again
        window.location.href = '/';
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
