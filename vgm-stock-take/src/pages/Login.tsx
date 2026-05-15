import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, Role } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { CheckCircle, Globe } from 'lucide-react';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
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
            setError('');
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
      setError('Please fill in all fields');
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
      } else if (data.role === 'Counter') {
        navigate('/stock-take');
      } else if (data.role === 'Operator Batt') {
        navigate('/battery');
      } else if (data.role === 'QA Inspector') {
        navigate('/qa');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
    <div className="flex justify-center items-center" style={{ minHeight: '100vh', padding: '1rem', background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)' }}>
      
      {/* Language Toggle */}
      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
        <Button variant="secondary" onClick={toggleLanguage} style={{ padding: '0.5rem 1rem' }}>
          <Globe size={18} /> {language}
        </Button>
      </div>

      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 3D VW Logo */}
        <div 
          className="animate-spin-3d" 
          style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #e0e0e0 0%, #ffffff 50%, #b0b0b0 100%)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '2rem',
            border: '4px solid #333'
          }}
        >
          {/* Simulated VW logo lines */}
          <div style={{
            position: 'absolute',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: '8px solid #333',
            display: 'flex',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
             <div style={{ width: '8px', height: '100%', backgroundColor: '#333', position: 'absolute', transform: 'rotate(25deg)', transformOrigin: 'bottom center', left: '15px' }}></div>
             <div style={{ width: '8px', height: '100%', backgroundColor: '#333', position: 'absolute', transform: 'rotate(-25deg)', transformOrigin: 'bottom center', right: '15px' }}></div>
             <div style={{ width: '8px', height: '50%', backgroundColor: '#333', position: 'absolute', bottom: 0 }}></div>
          </div>
        </div>

        <Card className="w-full" style={{ width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>VGM Stock Take 2026</h2>
          
          <form onSubmit={handleLogin} className="flex-col gap-4">
            <div style={{ position: 'relative' }}>
              <Input 
                label={t('userId')}
                placeholder="Enter ID (e.g. ADMIN01)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
              {role && (
                <div style={{ 
                  position: 'absolute', 
                  right: '1rem', 
                  top: '2.1rem',
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
              label={t('password')}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <div style={{ color: 'var(--danger-color)', fontSize: '0.875rem', textAlign: 'center', marginTop: '0.5rem' }}>{error}</div>}

            <Button 
              type="submit" 
              fullWidth 
              style={{ marginTop: '1rem' }}
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
