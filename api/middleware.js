/**
 * API Key Validation Middleware
 */

const { Project } = require('./models');

async function validateAPIKey(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      return res.status(401).json({
        error: 'Missing Authorization header'
      });
    }

    // Extract Bearer token
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(401).json({
        error: 'Invalid Authorization format. Use: Bearer <api-key>'
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
