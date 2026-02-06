'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import { API_BASE_URL } from '../lib/api';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [checkoutReady, setCheckoutReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    setIsLoggedIn(!!token);
  }, []);

  const loadRazorpayScript = () => new Promise<boolean>((resolve) => {
    if (document.getElementById('razorpay-checkout-js')) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  useEffect(() => {
    let isMounted = true;

    loadRazorpayScript().then((loaded) => {
      if (isMounted) {
        setCheckoutReady(loaded);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpgradeClick = async () => {
    const token = localStorage.getItem('authToken');

    if (!token) {
      window.location.href = '/signup?source=pricing';
      return;
    }

    setUpgradeError(null);
    setUpgradeLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/billing/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to start subscription');
      }

      if (!checkoutReady || !window.Razorpay || !result?.subscription?.id) {
        throw new Error('Razorpay checkout is not ready yet');
      }

      const options = {
        key: result.razorpayKey,
        subscription_id: result.subscription.id,
        name: 'CodePruner Pro',
        description: 'Unlimited projects and endpoints',
        theme: {
          color: '#f59e0b',
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Upgrade failed');
    } finally {
      setUpgradeLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>🔍 CodePruner</div>
          <nav className={styles.nav}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#pricing" className={styles.navLink}>Pricing</a>
          </nav>
        </div>
        {isLoggedIn ? (
          <a className={styles.headerCta} href="/projects">
            Go to Projects
          </a>
        ) : (
          <a className={styles.headerCta} href="/signup">
            Get Started Free
          </a>
        )}
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroGradient}></div>
          <h1 className={styles.heroTitle}>
            Find dead API endpoints <span className={styles.gradient}>before you delete</span> the wrong code.
          </h1>
          <p className={styles.heroSubhead}>
            CodePruner helps developers automatically detect dead API endpoints using real
            production traffic so they can clean up code safely and faster.
          </p>
          <div className={styles.heroActions}>
            {isLoggedIn ? (
              <a className={styles.primaryButton} href="/projects">
                Go to Projects →
              </a>
            ) : (
              <>
                <a className={styles.primaryButton} href="/signup">
                  Get Started Free
                </a>
                <span className={styles.noCard}>No credit card required</span>
              </>
            )}
          </div>
        </section>

        <section className={styles.section} id="features">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>The Problem</h2>
            <p className={styles.sectionSubtitle}>Why API cleanup matters</p>
          </div>
          <div className={styles.problemGrid}>
            <div className={styles.problemCard}>
              <div className={styles.problemIcon}>📦</div>
              <h3>Code Bloat</h3>
              <p>Unused APIs accumulate silently in production</p>
            </div>
            <div className={styles.problemCard}>
              <div className={styles.problemIcon}>😰</div>
              <h3>Fear of Deletion</h3>
              <p>Teams hesitate to remove code they don't understand</p>
            </div>
            <div className={styles.problemCard}>
              <div className={styles.problemIcon}>⏱️</div>
              <h3>Wasted Time</h3>
              <p>Manual analysis takes weeks instead of minutes</p>
            </div>
          </div>
        </section>

        <section className={styles.section} id="how">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>How it Works</h2>
            <p className={styles.sectionSubtitle}>Three simple steps to cleaner code</p>
          </div>
          <div className={styles.steps}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>Install SDK</h3>
              <p className={styles.stepText}>Add our lightweight middleware to your Express app.</p>
              <code className={styles.stepCode}>npm install codepruner</code>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>Track Traffic</h3>
              <p className={styles.stepText}>Capture real API usage from production automatically.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>See Results</h3>
              <p className={styles.stepText}>Dashboard shows dead, risky, and active endpoints.</p>
            </div>
          </div>
        </section>

        <section className={styles.section} id="features-detail">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Built for Developers</h2>
            <p className={styles.sectionSubtitle}>Everything you need to clean up safely</p>
          </div>
          <div className={styles.featuresGrid}>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>⚡</div>
              <h3>Zero Performance Impact</h3>
              <p>Fire-and-forget tracking that won't slow your API</p>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>🎯</div>
              <h3>Real Traffic Analysis</h3>
              <p>Based on actual production requests, not guesswork</p>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>🔒</div>
              <h3>Read-Only Access</h3>
              <p>CodePruner never modifies your code or data</p>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>📊</div>
              <h3>Beautiful Dashboard</h3>
              <p>Color-coded endpoint analysis at a glance</p>
            </div>
          </div>
        </section>

        <section className={styles.pricingSection} id="pricing">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
            <p className={styles.sectionSubtitle}>Choose the plan that fits your needs</p>
          </div>
          
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <h3 className={styles.planName}>Free</h3>
              <p className={styles.planDescription}>Perfect to get started</p>
              <div className={styles.planPrice}>$0<span className={styles.planPeriod}>/month</span></div>
              
              <button className={styles.pricingButton} disabled>
                {isLoggedIn ? 'Your Current Plan' : 'Get Started'}
              </button>

              <ul className={styles.planFeatures}>
                <li className={styles.planFeature}>
                  <span className={styles.featureCheck}>✓</span>
                  <span>1 Project</span>
                </li>
                <li className={styles.planFeature}>
                  <span className={styles.featureCheck}>✓</span>
                  <span>50 Endpoints max</span>
                </li>
                <li className={styles.planFeature}>
                  <span className={styles.featureCheck}>✓</span>
                  <span>30-day History</span>
                </li>
                <li className={styles.planFeature}>
                  <span className={styles.featureCheck}>✓</span>
                  <span>Email Support</span>
                </li>
                <li className={styles.planFeatureDisabled}>
                  <span className={styles.featureX}>✗</span>
                  <span>Priority Support</span>
                </li>
              </ul>
            </div>

            <div className={`${styles.pricingCard} ${styles.pricingCardPro}`}>
              <div className={styles.proBadge}>Most Popular</div>
              <h3 className={styles.planName}>Pro</h3>
              <p className={styles.planDescription}>For teams at scale</p>
              <div className={styles.planPrice}>₹1000<span className={styles.planPeriod}>/month</span></div>
              
              <button
                className={`${styles.pricingButtonPro} ${(isLoggedIn && (!checkoutReady || upgradeLoading)) ? styles.pricingButtonDisabled : ''}`}
                onClick={handleUpgradeClick}
                disabled={isLoggedIn && (!checkoutReady || upgradeLoading)}
              >
                {upgradeLoading ? 'Starting Checkout...' : (isLoggedIn ? 'Upgrade to Pro' : 'Sign up to Upgrade')}
              </button>
              {upgradeError && (
                <div className={styles.pricingError}>{upgradeError}</div>
              )}

              <ul className={styles.planFeatures}>
                <li className={styles.planFeature}>
                  <span className={styles.featureCheck}>✓</span>
                  <span>Unlimited Projects</span>
                </li>
                <li className={styles.planFeature}>
                  <span className={styles.featureCheck}>✓</span>
                  <span>Unlimited Endpoints</span>
                </li>
                <li className={styles.planFeature}>
                  <span className={styles.featureCheck}>✓</span>
                  <span>90-day History</span>
                </li>
                <li className={styles.planFeature}>
                  <span className={styles.featureCheck}>✓</span>
                  <span>Priority Email Support</span>
                </li>
                <li className={styles.planFeature}>
                  <span className={styles.featureCheck}>✓</span>
                  <span>Slack Notifications</span>
                </li>
              </ul>
            </div>
          </div>

          <p className={styles.pricingNote}>💡 No credit card required. Cancel anytime.</p>
        </section>

        <section className={styles.finalCta}>
          <h2 className={styles.ctaTitle}>Ready to clean up your APIs?</h2>
          <p className={styles.ctaSubtitle}>
            Join developers and teams who trust CodePruner to keep their code clean and maintainable.
          </p>
          {isLoggedIn ? (
            <a className={styles.primaryButton} href="/projects">
              Go to Projects →
            </a>
          ) : (
            <>
              <a className={styles.primaryButton} href="/signup">
                Get Started Free
              </a>
              <div className={styles.noCard}>No credit card required</div>
            </>
          )}
        </section>

        <footer className={styles.footer}>
          <p>© 2026 CodePruner. Find dead endpoints, ship faster.</p>
        </footer>
      </main>
    </div>
  );
}
