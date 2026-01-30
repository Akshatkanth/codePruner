/**
 * CodePruner - Express Middleware
 * Tracks API endpoint usage with minimal overhead
 */

const https = require('https');
const http = require('http');

class CodePruner {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.CP_API_KEY;
    this.apiEndpoint = options.apiEndpoint || process.env.CP_API_ENDPOINT || 'https://api.codepruner.com/track';
    this.enabled = options.enabled !== false && process.env.CP_ENABLED !== 'false';
    this.excludedRoutes = options.excludedRoutes || ['/health', '/metrics', '/healthz', '/readyz'];
    this.debug = options.debug === true || process.env.NODE_ENV !== 'production';
  }

  /**
   * Express middleware to track endpoint usage
   */
  middleware() {
    return (req, res, next) => {
      // Skip if tracking is disabled
      if (!this.enabled) {
        return next();
      }

      // Skip if no API key
      if (!this.apiKey) {
        if (this.debug) {
          console.warn('[CP] No API key provided. Tracking disabled.');
        }
        return next();
      }

      const startTime = Date.now();

      // Capture response on finish
      res.on('finish', () => {
        // Use setImmediate to ensure non-blocking
        setImmediate(() => {
          try {
            this._trackEndpoint(req, res, startTime);
          } catch (error) {
            // Silent fail - never crash the host app
            if (this.debug) {
              console.error('[CP] Error tracking endpoint:', error);
            }
          }
        });
      });

      next();
    };
  }

  /**
   * Track endpoint usage (internal method)
   */
  _trackEndpoint(req, res, startTime) {
    // Get route path (use req.route.path for actual route pattern)
    const routePath = req.route?.path || req.path || req.originalUrl;

    // Skip excluded routes
    if (this.excludedRoutes.includes(routePath)) {
      return;
    }

    // Prepare tracking data
    const trackingData = {
      method: req.method,
      route: routePath,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString(),
      latency: Date.now() - startTime
    };

    // Send data asynchronously (fire and forget)
    this._sendTracking(trackingData);
  }

  /**
   * Send tracking data to external API (non-blocking, no retries)
   */
  _sendTracking(data) {
    try {
      const url = new URL(this.apiEndpoint);
      const protocol = url.protocol === 'https:' ? https : http;

      const payload = JSON.stringify(data);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'CodePruner-SDK/1.0'
        },
        timeout: 5000 // 5 second timeout
      };

      const req = protocol.request(options, (res) => {
        // Drain response to free memory
        res.on('data', () => {});
        res.on('end', () => {});
      });

      // Handle errors silently
      req.on('error', (error) => {
        if (this.debug) {
          console.error('[CP] Failed to send tracking data:', error.message);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (this.debug) {
          console.warn('[CP] Request timeout');
        }
      });

      // Send the request
      req.write(payload);
      req.end();

    } catch (error) {
      if (this.debug) {
        console.error('[CP] Error sending tracking data:', error);
      }
    }
  }

  /**
   * Manually track a custom event (optional)
   */
  track(eventData) {
    if (!this.enabled || !this.apiKey) {
      return;
    }

    setImmediate(() => {
      try {
        this._sendTracking({
          ...eventData,
          timestamp: eventData.timestamp || new Date().toISOString()
        });
      } catch (error) {
        if (this.debug) {
          console.error('[CP] Error tracking custom event:', error);
        }
      }
    });
  }
}

module.exports = CodePruner;
