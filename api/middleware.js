/**
 * API Key Validation Middleware
 */

const crypto = require('crypto');
const { Project } = require('./models');

const hashApiKey = (apiKey) => crypto.createHash('sha256').update(apiKey).digest('hex');

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

    const apiKeyHash = hashApiKey(token);

    // Find project by API key hash
    let project = await Project.findOne({ apiKeyHash, active: true }).select('_id owner active');

    // Backward compatibility: migrate plaintext keys if still present
    if (!project) {
      const legacyProject = await Project.findOne({ apiKey: token, active: true }).select('_id owner active apiKey');
      if (legacyProject) {
        await Project.updateOne(
          { _id: legacyProject._id },
          { $set: { apiKeyHash }, $unset: { apiKey: 1 } }
        );
        project = legacyProject;
      }
    }

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
