import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { Eye, EyeOff, Download, Share, ArrowRight } from 'lucide-react';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const { addToast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth(); // We need to check if user is already logged in

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(standalone);

    // Check if iOS
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSPrompt(true);
      return;
    }
    if (!deferredPrompt) {
      addToast('Install prompt is not ready or unsupported by your browser.', 'error');
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        addToast('VGM CKD installed successfully!', 'success');
        setDeferredPrompt(null);
      } else {
        addToast('Installation was cancelled.', 'error');
      }
    } catch (err) {
      addToast('Something went wrong during installation.', 'error');
    }
  };

  useEffect(() => {
    if (user) {
      if (user.role === 'Admin' || user.role === 'Verifier') {
        navigate('/hub', { replace: true });
      } else if (user.role === 'Counter B17' || user.role === 'Counter B22') {
        navigate('/stock-take', { replace: true });
      } else if (user.role === 'Operator Batt') {
        navigate('/battery', { replace: true });
      } else if (user.role === 'QA Inspector') {
        navigate('/qa', { replace: true });
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    const savedUser = localStorage.getItem('vgm_remembered_user');
    if (savedUser) {
      setUserId(savedUser);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      addToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await login(userId, password);

      if (!result.success) {
        addToast(result.error || 'Invalid credentials. Please try again.', 'error');
        return;
      }

      if (rememberMe) {
        localStorage.setItem('vgm_remembered_user', userId);
      } else {
        localStorage.removeItem('vgm_remembered_user');
      }

      // Navigation happens via the effect above once `user` updates.
    } catch (err: any) {
      addToast(err.message || 'Login failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <style>{`
        .login-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--primary-color);
          position: relative;
          overflow: hidden;
          display: flex;
          justify-content: center;
        }
        .login-ghost {
          position: absolute; right: -40px; top: 140px;
          font-size: 230px; font-weight: 900; font-stretch: 70%; line-height: 0.8;
          color: transparent; -webkit-text-stroke: 1.5px rgba(255,255,255,0.08);
          pointer-events: none; user-select: none;
        }
        .login-col {
          position: relative;
          width: 100%;
          max-width: 460px;
          display: flex;
          flex-direction: column;
          padding-top: env(safe-area-inset-top);
        }
        .login-top { padding: 24px 24px 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .login-brand { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 800; font-size: 1.0625rem; letter-spacing: 0.02em; }
        .login-lang { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: rgba(255,255,255,0.08); }
        .login-lang button {
          height: 34px; min-width: 42px; border: 0; border-radius: 999px; background: transparent;
          color: var(--text-on-dark); font-family: inherit; font-size: 0.75rem; font-weight: 700; cursor: pointer;
        }
        .login-lang button.on { background: #fff; color: var(--primary-color); font-weight: 800; }
        .login-hero { padding: clamp(28px, 7vh, 56px) 24px 32px; }
        .login-hero h1 {
          margin: 12px 0 0; color: #fff; font-size: clamp(3.25rem, 15vw, 4.25rem); line-height: 0.88;
          font-weight: 900; font-stretch: 72%; text-transform: uppercase;
        }
        .login-hero p { margin: 18px 0 0; color: var(--text-on-dark); font-size: 0.9375rem; max-width: 300px; }
        .login-sheet {
          margin-top: auto;
          background: #fff;
          border-radius: 28px 28px 0 0;
          padding: 28px 24px calc(24px + env(safe-area-inset-bottom));
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        @media (min-width: 600px) {
          .login-col { justify-content: center; }
          .login-sheet { margin: 0 16px 32px; border-radius: 28px; }
        }
        .login-check { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
        .login-check input { width: 20px; height: 20px; margin: 0; accent-color: var(--primary-color); }
      `}</style>

      <div className="login-ghost" aria-hidden="true">CKD</div>

      <div className="login-col">
        <div className="login-top">
          <div className="login-brand">
            <div className="vw-badge" style={{ width: 52, height: 52 }}>
              <img src="/vw-logo.svg" alt="VW" className="animate-logo-intro" />
            </div>
            VGM CKD
          </div>
          <div className="login-lang" role="group" aria-label="Language">
            {(['EN', 'BM', 'DE'] as const).map(code => (
              <button key={code} type="button" className={language === code ? 'on' : ''} aria-pressed={language === code} onClick={() => setLanguage(code)}>
                {code}
              </button>
            ))}
          </div>
        </div>

        <div className="login-hero">
          <div className="eyebrow" style={{ color: 'var(--signal-color)' }}>Stock Take 2026</div>
          <h1>Count.<br />Check.<br />Verify.</h1>
          <p>CKD Logistic Department — plant inventory for B17, B22, LOMA and B22&nbsp;SEQ.</p>
        </div>

        <form onSubmit={handleLogin} className="login-sheet">
          <h2 style={{ margin: 0, fontSize: '1.625rem' }}>{t('login')}</h2>

          <div>
            <label htmlFor="login-user" className="ds-label">{t('userId')}</label>
            <input
              id="login-user"
              className="ds-fld mono"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="e.g. OperB17_16"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="login-pass" className="ds-label">{t('password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-pass"
                className="ds-fld"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '3.25rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 4, top: 4, width: 44, height: 44, border: 0, background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <label className="login-check">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            {t('rememberMe')}
          </label>

          <button type="submit" className="ds-btn signal lg block" disabled={loading}>
            {loading ? '...' : <>{t('login')} <ArrowRight size={20} strokeWidth={2.5} /></>}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <span>Forgot password? Ask your admin.</span>
            {!isStandalone && (
              <button
                type="button"
                onClick={handleInstallClick}
                style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 6, border: 0, background: 'none', color: 'var(--primary-color)', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                <Download size={16} /> Install app
              </button>
            )}
          </div>
        </form>
      </div>

      {/* iOS Install Prompt Modal */}
      {showIOSPrompt && (
        <div className="ds-overlay" style={{ alignItems: 'flex-end' }} role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
          <div className="ds-modal" style={{ textAlign: 'center' }}>
            <h3 id="ios-install-title">Install VGM CKD</h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.9375rem' }}>
              Add this app to your home screen for quick access, even offline.
            </p>
            <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'left', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                <span className="ds-iconbtn" style={{ width: 36, height: 36 }}><Share size={16} /></span>
                <span>1. Tap <strong>Share</strong> at the bottom of Safari.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                <span className="ds-iconbtn" style={{ width: 36, height: 36 }}><Download size={16} /></span>
                <span>2. Tap <strong>Add to Home Screen</strong>.</span>
              </div>
            </div>
            <button type="button" className="ds-btn ink block" onClick={() => setShowIOSPrompt(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
