/**
 * CodePruner Backend API Server
 * Ingests endpoint usage logs from SDK
 */

require('dotenv').config();
const express = require('express');
const connectDB = require('./db');
const validateAPIKey = require('./middleware');
const { EndpointLog, EndpointStatus } = require('./models');
const { validateTrackingPayload } = require('./validators');
const { scheduleCronJob, analyzeProject } = require('./cron-analyzer');

const app = express();

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(express.json({ limit: '10mb' })); // Support larger payloads
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Connect to MongoDB on startup
connectDB();

// Schedule cron job after DB connection
setTimeout(() => {
  scheduleCronJob();
}, 2000);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'CodePruner API' });
});

/**
 * POST /track
 * Accept and store endpoint usage logs
 */
app.post('/track', validateAPIKey, async (req, res) => {
  try {
    const payload = req.body;
    const projectId = req.project._id;

    // Validate payload
    const validation = validateTrackingPayload(payload);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error
      });
    }

    // Normalize to array
    const items = Array.isArray(payload) ? payload : [payload];

    // Prepare logs for insertion
    const logs = items.map(item => ({
      projectId,
      method: item.method.toUpperCase(),
      route: item.route,
      statusCode: item.statusCode,
      timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
      latency: item.latency || 0
    }));

    // Insert logs (fire and forget - no confirmation wait)
    EndpointLog.insertMany(logs, { ordered: false }).catch(error => {
      // Log errors but don't block response
      console.error('Error inserting logs:', error.message);
    });

    // Return immediately (don't wait for DB insert)
    res.status(202).json({
      success: true,
      message: `Accepted ${logs.length} log(s)`,
      count: logs.length
    });

  } catch (error) {
    console.error('Track endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /projects/:projectId/endpoints
 * Get all endpoints for a project with their status
 */
app.get('/projects/:projectId/endpoints', validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project ownership
    if (req.project._id.toString() !== projectId) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    // Get all endpoints for this project
    const endpoints = await EndpointStatus.find({ projectId })
      .select('method route status lastCalledAt callCount analyzedAt')
      .lean();

    // Define sort order: dead first, then risky, then active
    const statusOrder = { dead: 0, risky: 1, active: 2 };

    // Sort in JavaScript after fetching
    endpoints.sort((a, b) => {
      // Sort by status priority first
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      // Then by call count descending
      return b.callCount - a.callCount;
    });

    res.json({
      projectId,
      total: endpoints.length,
      dead: endpoints.filter(e => e.status === 'dead').length,
      risky: endpoints.filter(e => e.status === 'risky').length,
      active: endpoints.filter(e => e.status === 'active').length,
      endpoints
    });

  } catch (error) {
    console.error('Get endpoints error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /projects/:projectId/endpoints/status/:statusType
 * Get endpoints filtered by status (dead, risky, active)
 */
app.get('/projects/:projectId/endpoints/status/:statusType', validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const statusType = req.params.statusType.toLowerCase();

    // Verify project ownership
    if (req.project._id.toString() !== projectId) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    // Validate status type
    const validStatuses = ['dead', 'risky', 'active'];
    if (!validStatuses.includes(statusType)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Get endpoints with specific status
    const endpoints = await EndpointStatus.find({
      projectId,
      status: statusType
    })
      .select('method route status lastCalledAt callCount')
      .sort({ callCount: -1 })
      .lean();

    res.json({
      projectId,
      status: statusType,
      count: endpoints.length,
      endpoints
    });

  } catch (error) {
    console.error('Get endpoints by status error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /projects/:projectId/endpoints/summary
 * Get summary statistics for project endpoints
 */
app.get('/projects/:projectId/endpoints/summary', validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project ownership
    if (req.project._id.toString() !== projectId) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    // Get all endpoints for this project
    const endpoints = await EndpointStatus.find({ projectId }).lean();

    const summary = {
      projectId,
      total: endpoints.length,
      dead: endpoints.filter(e => e.status === 'dead').length,
      risky: endpoints.filter(e => e.status === 'risky').length,
      active: endpoints.filter(e => e.status === 'active').length,
      deadPercentage: endpoints.length > 0 
        ? ((endpoints.filter(e => e.status === 'dead').length / endpoints.length) * 100).toFixed(2) 
        : 0,
      riskyPercentage: endpoints.length > 0 
        ? ((endpoints.filter(e => e.status === 'risky').length / endpoints.length) * 100).toFixed(2) 
        : 0,
      activePercentage: endpoints.length > 0 
        ? ((endpoints.filter(e => e.status === 'active').length / endpoints.length) * 100).toFixed(2) 
        : 0,
      lastAnalyzedAt: endpoints.length > 0 
        ? Math.max(...endpoints.map(e => new Date(e.analyzedAt).getTime())) 
        : null
    };

    res.json(summary);

  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /analysis/:projectId
 * Get endpoint analysis results for a project (backward compatibility)
 */
app.get('/analysis/:projectId', validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project ownership
    if (req.project._id.toString() !== projectId) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    // Get analysis results
    const results = await EndpointStatus.find({ projectId }).sort({ callCount: -1 });

    const summary = {
      dead: results.filter(r => r.status === 'dead').length,
      risky: results.filter(r => r.status === 'risky').length,
      active: results.filter(r => r.status === 'active').length,
      total: results.length,
      lastAnalyzedAt: results.length > 0 ? results[0].analyzedAt : null
    };

    res.json({
      projectId,
      summary,
      endpoints: results
    });

  } catch (error) {
    console.error('Analysis endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /analysis/run-now/:projectId
 * Manually trigger analysis for a project (for testing)
 */
app.post('/analysis/run-now/:projectId', validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project ownership
    if (req.project._id.toString() !== projectId) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    await analyzeProject(projectId);

    res.json({
      success: true,
      message: 'Analysis triggered'
    });

  } catch (error) {
    console.error('Manual analysis error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('🚀 CodePruner API Server');
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🔑 API Key validation: ENABLED`);
  console.log(`📊 Endpoint analysis: ENABLED`);
  console.log(`💾 MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/codepruner'}\n`);
});

module.exports = app;
