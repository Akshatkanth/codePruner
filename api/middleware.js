/**
 * API Key Validation Middleware
 */

const { Project } = require('./models');

async function validateAPIKey(req, res, next) {
  try {
    const apiKeyHeader = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];

    let token = '';

    if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      token = apiKeyHeader.trim();
    } else if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    }

    if (!token) {
      return res.status(401).json({
        error: 'Missing API key. Use X-API-Key or Authorization: Bearer <api-key>'
      });
    }

    // Find project by API key
    const project = await Project.findOne({ apiKey: token, active: true });

    if (!project) {
      return res.status(401).json({
        error: 'Invalid or inactive API key'
      });
    }

    // Attach project to request
    req.project = project;
    next();
  } catch (error) {
    console.error('API Key validation error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
}

module.exports = validateAPIKey;
