'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './projects.module.css';
import { API_BASE_URL } from '../../lib/api';

interface Project {
  id: string;
  name: string;
  apiKey: string;
  description: string;
  createdAt: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch projects');
      }

      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    if (!token) return;

    setCreating(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      setProjects([data.project, ...projects]);
      setShowCreateForm(false);
      setNewProjectName('');
      setNewProjectDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, projectId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(projectId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Your Projects</h1>
            <p className={styles.subtitle}>Manage your CodePruner projects and API keys</p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => router.push('/')} className={styles.secondaryButton}>
              Home
            </button>
            <button onClick={() => router.push('/dashboard')} className={styles.secondaryButton}>
              Dashboard
            </button>
            <button onClick={handleLogout} className={styles.secondaryButton}>
              Logout
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          {!showCreateForm && (
            <button onClick={() => setShowCreateForm(true)} className={styles.primaryButton}>
              + Create New Project
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className={styles.createForm}>
            <h2 className={styles.formTitle}>Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className={styles.inputGroup}>
                <label htmlFor="name">Project Name</label>
                <input
                  id="name"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My API Project"
                  required
                  minLength={3}
                  disabled={creating}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="description">Description (optional)</label>
                <textarea
                  id="description"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="What is this project for?"
                  disabled={creating}
                  rows={3}
                />
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryButton} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewProjectName('');
                    setNewProjectDescription('');
                  }}
                  className={styles.secondaryButton}
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.projectsList}>
          {projects.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No projects yet. Create your first project to get started.</p>
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} className={styles.projectCard}>
                <div className={styles.projectHeader}>
                  <div>
                    <h3 className={styles.projectName}>{project.name}</h3>
                    {project.description && (
                      <p className={styles.projectDescription}>{project.description}</p>
                    )}
                  </div>
                  <span className={styles.projectDate}>
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className={styles.apiKeySection}>
                  <label>API Key</label>
                  <div className={styles.apiKeyDisplay}>
                    <code className={styles.apiKey}>{project.apiKey}</code>
                    <button
                      onClick={() => copyToClipboard(project.apiKey, project.id)}
                      className={styles.copyButton}
                    >
                      {copiedKey === project.id ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className={styles.projectActions}>
                  <button
                    onClick={() => {
                      localStorage.setItem('currentProjectId', project.id);
                      localStorage.setItem('currentApiKey', project.apiKey);
                      router.push('/dashboard');
                    }}
                    className={styles.viewDashboardButton}
                  >
                    View Dashboard
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
