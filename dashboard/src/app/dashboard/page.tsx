'use client';

import { useEffect, useState } from 'react';
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

interface OnboardingProgress {
  hasProjects: boolean;
  hasUsageLogs: boolean;
  hasEndpointStatus: boolean;
  isComplete: boolean;
}

export default function Dashboard() {
  const [data, setData] = useState<EndpointData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [configured, setConfigured] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedProjectId = localStorage.getItem('currentProjectId');
    const savedApiKey = localStorage.getItem('currentApiKey');

    if (token) {
      setAuthToken(token);
    }

    if (savedProjectId && savedApiKey && token) {
      setProjectId(savedProjectId);
      setApiKey(savedApiKey);
      setConfigured(true);
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

  const fetchOnboardingProgress = async () => {
    if (!authToken) return;

    try {
      const response = await fetch('http://localhost:5000/onboarding/progress', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setOnboarding(result);
      }
    } catch (err) {
      console.error('Failed to fetch onboarding progress:', err);
    }
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

  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRefreshNow = () => {
    if (configured) {
      fetchEndpoints();
      fetchOnboardingProgress();
    }
  };

  useEffect(() => {
    if (configured) {
      fetchEndpoints();
      fetchOnboardingProgress();
      const interval = setInterval(() => {
        fetchEndpoints();
        fetchOnboardingProgress();
      }, 30000);
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
          <div className={styles.headerActions}>
            <a href="/" className={styles.buttonSmall}>
              Home
            </a>
            <button onClick={handleRefreshNow} className={styles.buttonSmall}>
              🔄 Refresh
            </button>
            <button onClick={() => setShowCredentials(!showCredentials)} className={styles.buttonSmall}>
              {showCredentials ? 'Hide Credentials' : 'Show Credentials'}
            </button>
            <button onClick={() => setConfigured(false)} className={styles.buttonSmall}>
              Change Credentials
            </button>
          </div>
        </div>

        {showCredentials && (
          <div className={styles.credentialsPanel}>
            <h3 className={styles.credentialsTitle}>Your Credentials</h3>
            <div className={styles.credentialsList}>
              <div className={styles.credentialItem}>
                <label>Project ID</label>
                <div className={styles.credentialField}>
                  <span>{projectId}</span>
                  <button
                    onClick={() => copyToClipboard(projectId, 'projectId')}
                    className={styles.copyButton}
                    title="Copy to clipboard"
                  >
                    {copiedField === 'projectId' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className={styles.credentialItem}>
                <label>API Key</label>
                <div className={styles.credentialField}>
                  <span className={styles.secret}>{apiKey}</span>
                  <button
                    onClick={() => copyToClipboard(apiKey, 'apiKey')}
                    className={styles.copyButton}
                    title="Copy to clipboard"
                  >
                    {copiedField === 'apiKey' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className={styles.credentialItem}>
                <label>Auth Token (JWT)</label>
                <div className={styles.credentialField}>
                  <span className={styles.secret}>{authToken.substring(0, 20)}...</span>
                  <button
                    onClick={() => copyToClipboard(authToken, 'authToken')}
                    className={styles.copyButton}
                    title="Copy to clipboard"
                  >
                    {copiedField === 'authToken' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {onboarding && !onboarding.isComplete && (
          <div className={styles.onboarding}>
            <h2 className={styles.onboardingTitle}>Getting Started</h2>
            <div className={styles.checklistSteps}>
              <div className={`${styles.step} ${onboarding.hasProjects ? styles.stepComplete : ''}`}>
                <div className={styles.stepNumber}>{onboarding.hasProjects ? '✓' : '1'}</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Create a Project</div>
                  <div className={styles.stepDesc}>
                    {onboarding.hasProjects
                      ? 'Project created successfully'
                      : 'Go to Projects page to create your first project'}
                  </div>
                </div>
              </div>

              <div className={`${styles.step} ${onboarding.hasUsageLogs ? styles.stepComplete : ''}`}>
                <div className={styles.stepNumber}>{onboarding.hasUsageLogs ? '✓' : '2'}</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>Install SDK</div>
                  <div className={styles.stepDesc}>
                    {onboarding.hasUsageLogs
                      ? 'SDK is tracking your endpoints'
                      : 'Add CodePruner middleware to your Express app and make some requests'}
                  </div>
                </div>
              </div>

              <div className={`${styles.step} ${onboarding.hasEndpointStatus ? styles.stepComplete : ''}`}>
                <div className={styles.stepNumber}>{onboarding.hasEndpointStatus ? '✓' : '3'}</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>See Results</div>
                  <div className={styles.stepDesc}>
                    {onboarding.hasEndpointStatus
                      ? 'Analysis complete - view your results below'
                      : 'Analysis runs daily at 2 AM or trigger it manually via API'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && (!data || data.endpoints.length === 0) && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📊</div>
            <h2 className={styles.emptyTitle}>No Data Yet</h2>
            <p className={styles.emptyDesc}>
              {!onboarding?.hasProjects && 'Create a project to get started.'}
              {onboarding?.hasProjects && !onboarding?.hasUsageLogs &&
                'Install the SDK in your Express app and make some API requests.'}
              {onboarding?.hasUsageLogs && !onboarding?.hasEndpointStatus &&
                'Analysis will run automatically at 2 AM daily. Or trigger it manually via POST /analysis/run-now/:projectId'}
            </p>
            {!onboarding?.hasProjects && (
              <a href="/projects" className={styles.button}>
                Go to Projects
              </a>
            )}
          </div>
        )}

        {data && data.endpoints.length > 0 && (
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
