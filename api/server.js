/**
 * CodePruner Backend API Server
 * Ingests endpoint usage logs from SDK
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const Razorpay = require('razorpay');
const connectDB = require('./db');
const validateAPIKey = require('./middleware');
const { EndpointLog, EndpointStatus, User, Project } = require('./models');
const { validateTrackingPayload, validatePassword } = require('./validators');
const { scheduleCronJob, analyzeProject } = require('./cron-analyzer');
const authMiddleware = require('./auth-middleware');

const app = express();

// Initialize Razorpay client
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 20 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS Middleware with whitelist
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, '');

const allowedOrigins = (process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['https://codepruner.netlify.app']
).map(normalizeOrigin).filter(Boolean);

const corsHandler = (req, res, next) => {
  const rawOrigin = req.headers.origin;
  const origin = rawOrigin ? normalizeOrigin(rawOrigin) : '';

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', rawOrigin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
};

app.use(corsHandler);
app.options('*', corsHandler);

// Apply general rate limiting to all routes
app.use(generalLimiter);

const rawBodySaver = (req, res, buf) => {
  if (req.originalUrl === '/billing/webhook') {
    req.rawBody = buf.toString();
  }
};

// Middleware
app.use(express.json({ limit: '10mb', verify: rawBodySaver })); // Support larger payloads
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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const isProjectOwnedByUser = (req, projectId) => {
  if (!req.project || !req.project._id || !req.project.owner || !req.user?.userId) {
    return false;
  }

  return (
    req.project._id.toString() === projectId &&
    req.project.owner.toString() === req.user.userId
  );
};

/**
 * POST /auth/signup
 * Create a new user
 */
app.post('/auth/signup', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id');
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await User.create({
      email: normalizedEmail,
      passwordHash,
      verificationToken,
      emailVerified: false // In production, send verification email
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/login
 * Authenticate user and return JWT
 */
app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select('_id passwordHash failedLoginAttempts accountLockedUntil');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
      return res.status(423).json({ 
        error: `Account locked. Try again in ${remainingMinutes} minutes` 
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      // Increment failed attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updates = { failedLoginAttempts: failedAttempts };

      // Lock account after 5 failed attempts for 15 minutes
      if (failedAttempts >= 5) {
        updates.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await User.updateOne({ _id: user._id }, updates);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0 || user.accountLockedUntil) {
      await User.updateOne({ _id: user._id }, {
        failedLoginAttempts: 0,
        accountLockedUntil: null
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'JWT secret not configured' });
    }

    const token = jwt.sign({ userId: user._id.toString() }, secret, { expiresIn: '24h' });

    res.json({
      token,
      expiresIn: 86400 // 24 hours in seconds
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/forgot-password
 * Request password reset
 */
app.post('/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('_id');

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ 
        success: true, 
        message: 'If the email exists, a reset link will be sent' 
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await User.updateOne({ _id: user._id }, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetExpires
    });

    // In production: Send email with resetToken
    res.json({
      success: true,
      message: 'If the email exists, a reset link will be sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/reset-password
 * Reset password using token
 */
app.post('/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    }).select('_id');

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await User.updateOne({ _id: user._id }, {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      failedLoginAttempts: 0,
      accountLockedUntil: null
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /onboarding/progress
 * Get onboarding checklist progress for authenticated user
 */
app.get('/onboarding/progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Step 1: Check if user has any projects
    const projectCount = await Project.countDocuments({ owner: userId, active: true });
    const hasProjects = projectCount > 0;

    // Step 2: Check if any usage logs exist for user's projects
    let hasUsageLogs = false;
    if (hasProjects) {
      const userProjects = await Project.find({ owner: userId, active: true }).select('_id');
      const projectIds = userProjects.map(p => p._id.toString());
      const logCount = await EndpointLog.countDocuments({ 
        projectId: { $in: projectIds } 
      });
      hasUsageLogs = logCount > 0;
    }

    // Step 3: Check if endpoint status data exists (analysis has run)
    let hasEndpointStatus = false;
    if (hasUsageLogs) {
      const userProjects = await Project.find({ owner: userId, active: true }).select('_id');
      const projectIds = userProjects.map(p => p._id.toString());
      const statusCount = await EndpointStatus.countDocuments({ 
        projectId: { $in: projectIds } 
      });
      hasEndpointStatus = statusCount > 0;
    }

    res.json({
      hasProjects,
      hasUsageLogs,
      hasEndpointStatus,
      isComplete: hasProjects && hasUsageLogs && hasEndpointStatus
    });

  } catch (error) {
    console.error('Onboarding progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /user/profile
 * Get current user's profile information
 */
app.get('/user/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select('email plan createdAt');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get project count and endpoint count for limits display
    const projectCount = await Project.countDocuments({ owner: userId, active: true });
    
    let totalUniqueEndpoints = 0;
    if (projectCount > 0) {
      const userProjects = await Project.find({ owner: userId, active: true }).select('_id');
      const projectIds = userProjects.map(p => p._id);
      const endpointCounts = await Promise.all(
        projectIds.map(projectId => 
          EndpointLog.distinct('route', { projectId }).then(routes => routes.length)
        )
      );
      totalUniqueEndpoints = endpointCounts.reduce((sum, count) => sum + count, 0);
    }

    res.json({
      email: user.email,
      plan: user.plan,
      createdAt: user.createdAt,
      usage: {
        projects: projectCount,
        endpoints: totalUniqueEndpoints
      }
    });

  } catch (error) {
    console.error('User profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

    // Check endpoint limit for free users
    let logsToInsert = items;
    const project = req.project;
    
    if (project.owner) {
      const user = await User.findById(project.owner);
      
      if (user && user.plan === 'free') {
        // Get current unique endpoint count for this project
        const currentEndpoints = await EndpointLog.distinct('route', { projectId });
        const uniqueRoutesInRequest = [...new Set(items.map(item => item.route))];
        
        // Filter out routes that would exceed the 50 endpoint limit
        const newRoutes = uniqueRoutesInRequest.filter(
          route => !currentEndpoints.includes(route)
        );
        
        const availableSlots = 50 - currentEndpoints.length;
        
        if (newRoutes.length > availableSlots) {
          // Only allow logging of endpoints up to the limit
          const allowedNewRoutes = newRoutes.slice(0, availableSlots);
          logsToInsert = items.filter(
            item => currentEndpoints.includes(item.route) || allowedNewRoutes.includes(item.route)
          );
          
          if (logsToInsert.length < items.length) {
            console.warn(
              `Free user ${user.email} hit endpoint limit. ` +
              `Allowed ${logsToInsert.length}/${items.length} logs`
            );
          }
        }
      }
    }

    // Prepare logs for insertion
    const logs = logsToInsert.map(item => ({
      projectId,
      method: item.method.toUpperCase(),
      route: item.route,
      statusCode: item.statusCode,
      timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
      latency: item.latency || 0
    }));

    // Insert logs (fire and forget - no confirmation wait)
    if (logs.length > 0) {
      EndpointLog.insertMany(logs, { ordered: false }).catch(error => {
        // Log errors but don't block response
        console.error('Error inserting logs:', error.message);
      });
    }

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
app.get('/projects/:projectId/endpoints', authMiddleware, validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project ownership
    if (!isProjectOwnedByUser(req, projectId)) {
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
app.get('/projects/:projectId/endpoints/status/:statusType', authMiddleware, validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const statusType = req.params.statusType.toLowerCase();

    // Verify project ownership
    if (!isProjectOwnedByUser(req, projectId)) {
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
app.get('/projects/:projectId/endpoints/summary', authMiddleware, validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project ownership
    if (!isProjectOwnedByUser(req, projectId)) {
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
app.get('/analysis/:projectId', authMiddleware, validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project ownership
    if (!isProjectOwnedByUser(req, projectId)) {
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
app.post('/analysis/run-now/:projectId', authMiddleware, validateAPIKey, async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project ownership
    if (!isProjectOwnedByUser(req, projectId)) {
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

/**
 * POST /projects
 * Create a new project for the logged-in user
 */
app.post('/projects', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body || {};
    const userId = req.user.userId;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (name.trim().length < 3) {
      return res.status(400).json({ error: 'Project name must be at least 3 characters' });
    }

    // Get user plan
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check project limit for free users
    if (user.plan === 'free') {
      const projectCount = await Project.countDocuments({ owner: userId });
      if (projectCount >= 1) {
        return res.status(403).json({ 
          error: 'Free plan limited to 1 project. Upgrade to Pro for unlimited projects.' 
        });
      }
    }

    // Generate secure API key and secret
    const apiKey = 'cp_' + crypto.randomBytes(32).toString('hex');
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const apiSecret = crypto.randomBytes(32).toString('hex');

    const project = await Project.create({
      name: name.trim(),
      owner: userId,
      apiKeyHash,
      apiSecret,
      description: description || '',
      active: true
    });

    res.status(201).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        apiKey,
        description: project.description,
        createdAt: project.createdAt
      }
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /projects
 * Get all projects owned by the logged-in user
 */
app.get('/projects', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const projects = await Project.find({ owner: userId, active: true })
      .select('name description createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      projects: projects.map(p => ({
        id: p._id,
        name: p.name,
        apiKey: null,
        description: p.description,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /projects/:projectId
 * Soft delete a project (set active to false)
 */
app.delete('/projects/:projectId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.projectId;

    const project = await Project.findOne({ _id: projectId, owner: userId });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await Project.updateOne({ _id: projectId }, { active: false });

    res.json({
      success: true,
      message: 'Project deleted'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
/**
 * POST /billing/subscribe
 * Create a Razorpay subscription for the user
 */
app.post('/billing/subscribe', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already subscribed
    if (user.razorpaySubscriptionId) {
      return res.status(400).json({ error: 'User already has an active subscription' });
    }

    // Create subscription via Razorpay
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      customer_notify: 1,
      quantity: 1,
      total_count: 12, // Annual subscription
    });

    // Store subscription ID on user
    user.razorpaySubscriptionId = subscription.id;
    await user.save();

    res.json({
      success: true,
      message: 'Subscription created successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan_id: subscription.plan_id,
      },
      // Return Razorpay key for checkout
      razorpayKey: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * POST /billing/webhook
 * Handle Razorpay webhook events
 */
app.post('/billing/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.rawBody || JSON.stringify(req.body || {});

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body);

    // Handle subscription.activated event
    if (event.event === 'subscription.activated') {
      const subscriptionId = event.payload.subscription.entity.id;

      // Find user by subscription ID
      const user = await User.findOne({ razorpaySubscriptionId: subscriptionId });

      if (user) {
        // Upgrade to pro plan
        user.plan = 'pro';
        await user.save();
        console.log(`✅ User ${user.email} upgraded to pro plan`);
      }
    }

    // Handle subscription.cancelled event (optional)
    if (event.event === 'subscription.cancelled') {
      const subscriptionId = event.payload.subscription.entity.id;
      const user = await User.findOne({ razorpaySubscriptionId: subscriptionId });

      if (user) {
        // Downgrade to free plan
        user.plan = 'free';
        user.razorpaySubscriptionId = null;
        await user.save();
        console.log(`📉 User ${user.email} downgraded to free plan`);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
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
