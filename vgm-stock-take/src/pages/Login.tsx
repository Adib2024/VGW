import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, Role } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CheckCircle, Globe, Lock, Download, Share } from 'lucide-react';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(null);
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

  useEffect(() => {
    const lookupRole = async () => {
      if (userId.trim().length >= 2) {
        try {
          const { data } = await supabase
            .from('users')
            .select('role, name')
            .ilike('id', userId.trim())
            .single();

          if (data) {
            setRole(data.role as Role);
          } else {
            setRole(null);
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        setRole(null);
      }
    };

    const debounceTimeout = setTimeout(lookupRole, 500);
    return () => clearTimeout(debounceTimeout);
  }, [userId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      addToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data: isValid, error: verifyError } = await supabase
        .rpc('verify_password', { p_user_id: userId, p_password: password });

      if (verifyError || !isValid) {
        addToast('Invalid credentials. Please try again.', 'error');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('id', userId)
        .single();

      if (error || !data) {
        addToast('Invalid credentials. Please try again.', 'error');
        return;
      }

      if (rememberMe) {
        localStorage.setItem('vgm_remembered_user', userId);
      } else {
        localStorage.removeItem('vgm_remembered_user');
      }

      await login({ id: data.id, name: data.name, role: data.role as Role });

      // Navigate based on role
      if (data.role === 'Admin' || data.role === 'Verifier') {
        navigate('/hub');
      } else if (data.role === 'Counter B17' || data.role === 'Counter B22') {
        navigate('/stock-take');
      } else if (data.role === 'Operator Batt') {
        navigate('/battery');
      } else if (data.role === 'QA Inspector') {
        navigate('/qa');
      }
    } catch (err: any) {
      addToast(err.message || 'Login failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="flex justify-center items-center" style={{ minHeight: '100vh', padding: '1rem', position: 'relative', overflow: 'hidden' }}>

      {/* Background Decor */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '1200px', height: '1200px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* PWA Install Button (Always visible during dev if not installed) */}
      {!isStandalone && (
        <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 20 }}>
          <button 
            onClick={handleInstallClick}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem',
              padding: '0.4rem 0.8rem', 
              borderRadius: 'var(--radius-full)', 
              border: '1px solid rgba(0,30,80,0.2)', 
              backgroundColor: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(10px)',
              color: 'var(--primary-color)',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease'
            }}
          >
            <Download size={14} /> Install App
          </button>
        </div>
      )}

      {/* Language Toggle */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 20 }}>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as any)}
          style={{
            padding: '0.25rem 1rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--surface-color)',
            color: 'var(--text-primary)',
            outline: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          <option value="EN">English</option>
          <option value="BM">Bahasa Melayu</option>
          <option value="DE">Deutsch</option>
        </select>
      </div>

      <div style={{ width: '100%', maxWidth: '400px', zIndex: 10, padding: '0 1rem' }}>

        <Card className="w-full" style={{ padding: '2.5rem 2rem', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#ffffff', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>

          {/* Logo in rounded box */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <img
              src="/vw-logo.svg"
              alt="VW Logo"
              className="animate-spin-3d"
              style={{ width: '64px', height: '64px' }}
            />
          </div>

          <h2 style={{ textAlign: 'center', margin: '0', color: 'var(--primary-color)', fontSize: '1.25rem', fontWeight: 700 }}>VGM CKD</h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '0.75rem', marginBottom: '2rem' }}>
            CKD Logistic Department
          </p>

          <form onSubmit={handleLogin} className="flex-col gap-4" style={{ width: '100%' }}>

            {/* User ID */}
            <Input
              label={t('userId')}
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              rightElement={role && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success-color)', fontSize: '0.75rem', fontWeight: 500 }}>
                  <CheckCircle size={14} /> {role}
                </div>
              )}
            />

            {/* Password */}
            <Input
              label={t('password')}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              rightElement={(
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}>
                  {showPassword ? <Globe size={16} /> : <Lock size={16} />}
                </button>
              )}
            />

            {/* Remember Me */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="checkbox" id="remember" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="remember" style={{ fontSize: '0.75rem', color: '#666', cursor: 'pointer' }}>{t('rememberMe')}</label>
            </div>
            <Button
              type="submit"
              fullWidth
              style={{ marginTop: '1rem', backgroundColor: 'var(--primary-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}
              disabled={loading}
            >
              {loading ? '...' : t('login')}
            </Button>
          </form>
        </Card>
      </div>

      {/* iOS Install Prompt Modal */}
      {showIOSPrompt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem 1.5rem',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
            textAlign: 'center',
            width: '100%',
            maxWidth: '400px',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: '#e2e8f0', borderRadius: 'var(--radius-xs)', margin: '0 auto 1.5rem auto' }} />
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '1.25rem', fontWeight: 800 }}>Install VGM CKD</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#475569', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Install this application on your home screen for quick and easy access when you're offline.
            </p>
            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-card)', textAlign: 'left', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <span style={{ backgroundColor: 'white', padding: '0.4rem', borderRadius: 'var(--radius-md)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}><Share size={16} color="var(--primary-color)" /></span>
                <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>1. Tap the <strong>Share</strong> button at the bottom of Safari.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ backgroundColor: 'white', padding: '0.4rem', borderRadius: 'var(--radius-md)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}><Download size={16} color="var(--primary-color)" /></span>
                <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>2. Tap <strong>Add to Home Screen</strong>.</span>
              </div>
            </div>
            <Button fullWidth onClick={() => setShowIOSPrompt(false)} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
