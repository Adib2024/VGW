import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, Role } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { CheckCircle, Globe, User, Lock } from 'lucide-react';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const { addToast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const lookupRole = async () => {
      if (userId.length >= 4) {
        try {
          const { data } = await supabase
            .from('users')
            .select('role, name')
            .eq('id', userId)
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
        throw new Error('Invalid credentials');
      }
      
      login({ id: data.id, name: data.name, role: data.role as Role });
      
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
      addToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    const langs: ('EN'|'BM'|'DE')[] = ['EN', 'BM', 'DE'];
    const nextIndex = (langs.indexOf(language) + 1) % langs.length;
    setLanguage(langs[nextIndex]);
  };

  return (
    <div className="flex justify-center items-center" style={{ minHeight: '100vh', padding: '1rem', position: 'relative' }}>
      
      {/* Background Decor (optional rings to match reference) */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '1200px', height: '1200px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Language Toggle */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
        <Button variant="secondary" onClick={toggleLanguage} style={{ padding: '0.5rem 1rem', backgroundColor: 'rgba(255,255,255,0.5)', border: 'none', backdropFilter: 'blur(10px)' }}>
          <Globe size={18} color="var(--text-primary)" /> <span style={{color: 'var(--text-primary)'}}>{language}</span>
        </Button>
      </div>

      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, padding: '0 0.5rem' }}>
        
        <Card className="w-full" style={{ padding: '2.5rem 1.5rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Logo in rounded box */}
          <div style={{ 
            width: '64px', 
            height: '64px', 
            backgroundColor: '#ffffff', 
            borderRadius: '16px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            marginBottom: '1.5rem'
          }}>
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg" 
              alt="VW Logo" 
              className="animate-spin-3d"
              style={{ width: '40px', height: '40px' }} 
            />
          </div>
          
          <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 600 }}>VGM Stock Take 2026</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem', maxWidth: '80%' }}>
            Manage warehouse inventory seamlessly. Internal tool.
          </p>
          
          <form onSubmit={handleLogin} className="flex-col gap-4">
            <div style={{ position: 'relative' }}>
              <Input 
                icon={<User size={18} />}
                placeholder="User ID (e.g. ADMIN01)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
              {role && (
                <div style={{ 
                  position: 'absolute', 
                  right: '1rem', 
                  top: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: 'var(--success-color)',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}>
                  <CheckCircle size={16} /> {role}
                </div>
              )}
            </div>

            <Input 
              icon={<Lock size={18} />}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button 
              type="submit" 
              fullWidth 
              style={{ marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? '...' : t('login')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
