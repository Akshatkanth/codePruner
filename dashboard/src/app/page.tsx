import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>CodePruner</div>
        <a className={styles.headerCta} href="/signup">
          Get Started Free
        </a>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Find dead API endpoints before you delete the wrong code.
          </h1>
          <p className={styles.heroSubhead}>
            CodePruner helps developers automatically detect dead API endpoints using real
            production traffic so they can clean up code safely and faster.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="/signup">
              Get Started Free
            </a>
            <span className={styles.noCard}>No credit card required</span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>The problem</h2>
          <p className={styles.sectionText}>
            Unused API endpoints pile up quietly. Teams stop knowing what is safe to remove,
            and the fear of deleting production code slows every cleanup. Legacy APIs linger,
            and systems grow bloated.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>How it works</h2>
          <div className={styles.steps}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>Install lightweight SDK</h3>
              <p className={styles.stepText}>Add a single middleware and start observing traffic.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>Track real API usage</h3>
              <p className={styles.stepText}>Capture production calls without impacting performance.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>See dead, risky, active</h3>
              <p className={styles.stepText}>The dashboard labels endpoints so you can prune safely.</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Product preview</h2>
          <div className={styles.previewGrid}>
            <div className={styles.previewBox}>Dashboard screenshot placeholder</div>
            <ul className={styles.previewList}>
              <li>No performance impact</li>
              <li>Uses real traffic</li>
              <li>Read-only analysis</li>
            </ul>
          </div>
        </section>

        <section className={styles.finalCta}>
          <h2 className={styles.sectionTitle}>Start pruning with confidence</h2>
          <p className={styles.sectionText}>
            Know exactly what is safe to remove before you touch production code.
          </p>
          <a className={styles.primaryButton} href="/signup">
            Get Started Free
          </a>
          <div className={styles.noCard}>No credit card required</div>
        </section>
      </main>
    </div>
  );
}
