'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // Redirect to login after successful signup
      router.push('/login?signup=success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <a 
        href="/" 
        className={styles.homeLink}
        style={{
          position: 'fixed',
          top: '1.5rem',
          left: '1.5rem',
          backgroundColor: '#2563eb',
          color: '#fff',
          padding: '0.75rem 1.5rem',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: 'bold',
          zIndex: 9999,
          border: '2px solid #1d4ed8'
        }}
      >
        ← Home
      </a>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>Start detecting dead endpoints today</p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={loading}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                required
                disabled={loading}
                minLength={8}
              />
              <small style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Must contain uppercase, lowercase, and number
              </small>
            </div>

            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>

          <p className={styles.footer}>
            Already have an account?{' '}
            <a href="/login" className={styles.link}>
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
