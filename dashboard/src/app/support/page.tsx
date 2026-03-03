import styles from '../projects/projects.module.css';

export default function SupportPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Contact & Support</h1>
            <p className={styles.subtitle}>Reach out through any of these channels</p>
          </div>
          <div className={styles.headerActions}>
            <a href="/" className={styles.secondaryButton}>Home</a>
            <a href="/projects" className={styles.secondaryButton}>Projects</a>
            <a href="/dashboard" className={styles.secondaryButton}>Dashboard</a>
          </div>
        </div>

        <div className={styles.projectsList}>
          <div className={styles.projectCard}>
            <div className={styles.projectHeader}>
              <h2 className={styles.projectName}>Discord</h2>
            </div>
            <p className={styles.projectDescription}>Username: igneel69</p>
            <div className={styles.projectActions}>
              <a
                href="https://discord.com/app"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.viewDashboardButton}
              >
                Open Discord
              </a>
            </div>
          </div>

          <div className={styles.projectCard}>
            <div className={styles.projectHeader}>
              <h2 className={styles.projectName}>Email</h2>
            </div>
            <p className={styles.projectDescription}>kanthakshat@gmail.com</p>
            <div className={styles.projectActions}>
              <a href="mailto:kanthakshat@gmail.com" className={styles.viewDashboardButton}>
                Send Email
              </a>
            </div>
          </div>

          <div className={styles.projectCard}>
            <div className={styles.projectHeader}>
              <h2 className={styles.projectName}>GitHub</h2>
            </div>
            <p className={styles.projectDescription}>https://github.com/Akshatkanth</p>
            <div className={styles.projectActions}>
              <a
                href="https://github.com/Akshatkanth"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.viewDashboardButton}
              >
                Open GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}