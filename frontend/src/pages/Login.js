import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const result = await login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'sans-serif' 
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '40px', 
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px', 
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📈</div>
        
        <h2 style={{ 
          fontSize: '28px', 
          fontWeight: '900',
          margin: '0 0 10px 0',
          color: '#1a202c'
        }}>
          Welcome Back
        </h2>
        
        <p style={{ 
          color: '#64748b', 
          fontSize: '15px',
          marginBottom: '30px'
        }}>
          Sign in to <span style={{ color: '#667eea', fontWeight: '700' }}>StockIntel</span>
        </p>

        {error && (
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            color: '#ef4444', 
            padding: '12px', 
            borderRadius: '12px', 
            fontSize: '13px', 
            marginBottom: '25px', 
            border: '1px solid rgba(239, 68, 68, 0.2)' 
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '20px' 
        }}>
          
          <input 
            type="email" 
            required 
            placeholder="Email Address" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '16px 20px', 
              borderRadius: '12px', 
              border: '2px solid #e2e8f0', 
              fontSize: '15px', 
              outline: 'none', 
              boxSizing: 'border-box',
              transition: 'border 0.3s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />

          <input 
            type="password" 
            required 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '16px 20px', 
              borderRadius: '12px', 
              border: '2px solid #e2e8f0', 
              fontSize: '15px', 
              outline: 'none', 
              boxSizing: 'border-box',
              transition: 'border 0.3s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              marginTop: '10px', 
              padding: '16px', 
              borderRadius: '12px', 
              border: 'none', 
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              color: 'white', 
              fontSize: '16px', 
              fontWeight: '700', 
              cursor: loading ? 'not-allowed' : 'pointer', 
              transition: '0.3s',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ 
          marginTop: '30px', 
          color: '#64748b', 
          fontSize: '14px' 
        }}>
          Don't have an account? <Link to="/register" style={{ 
            color: '#667eea', 
            textDecoration: 'none', 
            fontWeight: '700' 
          }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
