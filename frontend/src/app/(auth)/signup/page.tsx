'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { SignupSchema } from '@klypup/shared';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [orgName, setOrgName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setValidationErrors({});

    const formData = { orgName, name, email, password };
    const parseResult = SignupSchema.safeParse(formData);

    if (!parseResult.success) {
      const fieldErrors: { [key: string]: string } = {};
      parseResult.error.errors.forEach((err) => {
        const fieldName = err.path[0] as string;
        fieldErrors[fieldName] = err.message;
      });
      setValidationErrors(fieldErrors);
      setIsLoading(false);
      return;
    }

    try {
      await signup(parseResult.data);
      router.push('/');
    } catch (err: any) {
      setError(err.error || err.message || 'Registration failed');
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', textAlign: 'center', color: '#111' }}>Create Account</h2>
        
        {error && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={isLoading}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
            />
            {validationErrors.orgName && (
              <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{validationErrors.orgName}</span>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
            />
            {validationErrors.name && (
              <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{validationErrors.name}</span>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
            />
            {validationErrors.email && (
              <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{validationErrors.email}</span>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: '#374151' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
            />
            {validationErrors.password && (
              <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{validationErrors.password}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Registering...' : 'Sign Up'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', textAlign: 'center', color: '#6b7280' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: '500' }}>
            Log In
          </a>
        </p>
      </div>
    </div>
  );
}
