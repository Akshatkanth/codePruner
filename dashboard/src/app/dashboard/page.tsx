'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface Endpoint {
  _id: string;
  method: string;
  route: string;
  status: 'dead' | 'risky' | 'active';
  callCount: number;
  lastCalledAt: string | null;
}

interface EndpointData {
  projectId: string;
  total: number;
  dead: number;
  risky: number;
  active: number;
  endpoints: Endpoint[];
}

export default function Dashboard() {
  const [data, setData] = useState<EndpointData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [configured, setConfigured] = useState(false);

  // Load token from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuthToken(token);
    }
  }, []);

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const fetchEndpoints = async () => {
    if (!projectId || !apiKey || !authToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:5000/projects/${projectId}/endpoints`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigure = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigured(true);
    fetchEndpoints();
  };

  useEffect(() => {
    if (configured) {
      fetchEndpoints();
      const interval = setInterval(fetchEndpoints, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [configured, projectId, apiKey, authToken]);

  if (!configured) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>CodePruner Dashboard</h1>
          <p className={styles.description}>Configure your API credentials</p>

          <form onSubmit={handleConfigure} className={styles.configForm}>
            <div className={styles.inputGroup}>
              <label htmlFor="projectId">Project ID</label>
              <input
                id="projectId"
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="697f70e806699212b4bd0548"
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="apiKey">API Key</label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="cp_xxxxx"
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="authToken">Auth Token (JWT)</label>
              <input
                id="authToken"
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="eyJhbGciOi..."
                required
              />
            </div>

            <button type="submit" className={styles.button}>
              Connect
            </button>
          </form>
        </main>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.loading}>Loading...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.error}>Error: {error}</div>
          <button onClick={() => setConfigured(false)} className={styles.button}>
            Reconfigure
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>CodePruner Dashboard</h1>
          <button onClick={() => setConfigured(false)} className={styles.buttonSmall}>
            Change Credentials
          </button>
        </div>

        {data && (
          <>
            <div className={styles.summary}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{data.total}</div>
                <div className={styles.statLabel}>Total Endpoints</div>
              </div>
              <div className={`${styles.statCard} ${styles.statDead}`}>
                <div className={styles.statValue}>{data.dead}</div>
                <div className={styles.statLabel}>Dead</div>
              </div>
              <div className={`${styles.statCard} ${styles.statRisky}`}>
                <div className={styles.statValue}>{data.risky}</div>
                <div className={styles.statLabel}>Risky</div>
              </div>
              <div className={`${styles.statCard} ${styles.statActive}`}>
                <div className={styles.statValue}>{data.active}</div>
                <div className={styles.statLabel}>Active</div>
              </div>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Method</th>
                    <th>Route</th>
                    <th>Calls</th>
                    <th>Last Called</th>
                  </tr>
                </thead>
                <tbody>
                  {data.endpoints.map((endpoint) => (
                    <tr key={endpoint._id} className={styles[`row-${endpoint.status}`]}>
                      <td>
                        <span className={`${styles.badge} ${styles[`badge-${endpoint.status}`]}`}>
                          {endpoint.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={styles.method}>{endpoint.method}</span>
                      </td>
                      <td className={styles.route}>{endpoint.route}</td>
                      <td>{endpoint.callCount}</td>
                      <td className={styles.time}>
                        {formatRelativeTime(endpoint.lastCalledAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
