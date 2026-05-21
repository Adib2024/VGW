import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, Role } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CheckCircle, Globe, Lock, Download } from 'lucide-react';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const { login } = useAuth();
  const { addToast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth(); // We need to check if user is already logged in

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

    // PWA Install Prompt Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('password', password)
        .single();
        
      if (error || !data) {
        setShowErrorModal(true);
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
      window.alert(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="flex justify-center items-center" style={{ minHeight: '100vh', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background Decor */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '1200px', height: '1200px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Language Toggle */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 20 }}>
        <select 
          value={language}
          onChange={(e) => setLanguage(e.target.value as any)}
          style={{ 
            padding: '0.25rem 1rem', 
            borderRadius: '999px', 
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
        
        <Card className="w-full" style={{ padding: '2.5rem 2rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#ffffff', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          
          {/* Logo in rounded box */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg" 
              alt="VW Logo" 
              className="animate-spin-3d"
              style={{ width: '64px', height: '64px' }} 
            />
          </div>
          
          <h2 style={{ textAlign: 'center', margin: '0', color: '#001e50', fontSize: '1.25rem', fontWeight: 700 }}>VGM Stock Take 2026</h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '0.75rem', marginBottom: '2rem' }}>
            CKD Logistic Department
          </p>
          
          <form onSubmit={handleLogin} className="flex-col gap-4" style={{ width: '100%' }}>
            
            {/* User ID */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#333' }}>{t('userId')}</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e0e0e0', outline: 'none', fontSize: '0.875rem' }}
                  required
                />
                {role && (
                  <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success-color)', fontSize: '0.75rem', fontWeight: 500 }}>
                    <CheckCircle size={14} /> {role}
                  </div>
                )}
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#333' }}>{t('password')}</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e0e0e0', outline: 'none', fontSize: '0.875rem' }}
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                  {showPassword ? <Globe size={16} /> : <Lock size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="checkbox" id="remember" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="remember" style={{ fontSize: '0.75rem', color: '#666', cursor: 'pointer' }}>{t('rememberMe')}</label>
            </div>
            <Button 
              type="submit" 
              fullWidth 
              style={{ marginTop: '1rem', backgroundColor: '#1877f2', borderRadius: '8px', padding: '0.75rem' }}
              disabled={loading}
            >
              {loading ? '...' : t('login')}
            </Button>
          </form>
          
          {/* Custom PWA Install Button */}
          {deferredPrompt && (
            <div style={{ marginTop: '1.5rem', width: '100%', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
              <Button 
                type="button" 
                variant="secondary"
                fullWidth 
                style={{ backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={async () => {
                  if (deferredPrompt) {
                    try {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') {
                        setDeferredPrompt(null);
                      }
                    } catch (err) {
                      console.error("Install prompt error:", err);
                      alert("Automatic install failed. Please click 'Share' or the browser menu, then select 'Add to Home Screen' manually.");
                    }
                  }
                }}
              >
                <Download size={18} />
                Install Native App
              </Button>
            </div>
          )}
        </Card>
      </div>
      {showErrorModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            textAlign: 'center',
            maxWidth: '350px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.25rem', fontWeight: 800 }}>{window.location.host} says</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#475569', fontSize: '0.95rem', fontWeight: 500 }}>Invalid credentials. Please try again.</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => setShowErrorModal(false)} style={{ minWidth: '100px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
