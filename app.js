/**
 * Example Usage - CodePruner SDK
 */

const express = require('express');
require('dotenv').config();
const CodePruner = require('./middleware');

const app = express();
app.use(express.json());

// Initialize CodePruner
const codePruner = new CodePruner({
  apiKey: process.env.CP_API_KEY || 'your-api-key-here',
  apiEndpoint: process.env.CP_API_ENDPOINT || 'http://localhost:5000/track',
  enabled: process.env.CP_ENABLED !== 'false',
  excludedRoutes: ['/health', '/metrics'],
  debug: process.env.NODE_ENV !== 'production'
});

// Apply middleware globally
app.use(codePruner.middleware());

// Health check endpoint (excluded from tracking)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Example API endpoints
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/api/users', (req, res) => {
  res.status(201).json({ id: 1, name: 'John Doe' });
});

app.get('/api/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'John Doe' });
});

app.put('/api/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Updated' });
});

app.delete('/api/users/:id', (req, res) => {
  res.status(204).send();
});

// Legacy endpoint (might be unused)
app.get('/api/legacy/old-feature', (req, res) => {
  res.json({ message: 'This might be unused' });
});

// Another example endpoint
app.get('/api/products', (req, res) => {
  res.json({ products: [] });
});

app.post('/api/products', (req, res) => {
  res.status(201).json({ id: 1, name: 'Product' });
});

// Manually track custom events (optional)
app.post('/api/checkout', (req, res) => {
  // Your checkout logic here
  
  // Optionally track custom business events
  codePruner.track({
    event: 'checkout_completed',
    method: 'POST',
    route: '/api/checkout',
    statusCode: 200,
    metadata: {
      orderId: '12345',
      amount: 99.99
    }
  });

  res.json({ success: true });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CodePruner: ${codePruner.enabled ? 'ENABLED' : 'DISABLED'}`);
});

module.exports = app;
