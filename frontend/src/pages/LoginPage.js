import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Activity, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@hospital.com');
  const [password, setPassword] = useState('Admin@2025');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (role) => {
    const creds = {
      admin: { email: 'admin@hospital.com', password: 'Admin@2025' },
      doctor: { email: 'doctor@hospital.com', password: 'Doctor@2025' },
      analyst: { email: 'analyst@hospital.com', password: 'Analyst@2025' }
    };
    setEmail(creds[role].email);
    setPassword(creds[role].password);
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="bg-grid" />
        <div className="bg-glow" />
      </div>

      <div className="login-container fade-in">
        <div className="login-header">
          <div className="login-logo">
            <Activity size={28} />
          </div>
          <h1>HealthAnalytics Pro</h1>
          <p>AWS-Powered Healthcare Intelligence Platform</p>
          <div className="aws-stack-badges">
            {['EC2', 'RDS', 'Lambda', 'S3', 'CloudWatch'].map(svc => (
              <span key={svc} className="aws-svc-badge">{svc}</span>
            ))}
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="doctor@hospital.com"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Authenticating...</> : 'Sign In to Dashboard'}
          </button>
        </form>

        <div className="quick-login">
          <span>Quick access:</span>
          {['admin', 'doctor', 'analyst'].map(role => (
            <button key={role} className="btn btn-ghost quick-btn" onClick={() => quickLogin(role)}>
              {role}
            </button>
          ))}
        </div>

        <div className="login-footer">
          <span>🔒 HIPAA-compliant • JWT Auth • IAM Role-Based Access</span>
        </div>
      </div>
    </div>
  );
}
