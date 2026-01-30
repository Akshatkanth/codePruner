/**
 * Test Script for CodePruner SDK
 */

const express = require('express');
const http = require('http');
const CodePruner = require('./middleware');

console.log('🧪 Testing CodePruner SDK...\n');

// Create test app
const app = express();
app.use(express.json());

// Initialize CodePruner with test endpoint
const codePruner = new CodePruner({
  apiKey: 'test-api-key-123',
  apiEndpoint: 'http://localhost:4000/track', // Mock endpoint
  enabled: true,
  excludedRoutes: ['/health'],
  debug: true // Enable debug logging
});

// Apply middleware
app.use(codePruner.middleware());

// Test routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/users', (req, res) => {
  res.json({ users: [{ id: 1, name: 'John' }] });
});

app.post('/api/users', (req, res) => {
  res.status(201).json({ id: 2, name: 'Jane' });
});

app.get('/api/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'John Doe' });
});

app.delete('/api/products/:id', (req, res) => {
  res.status(204).send();
});

// Start test server
const testServer = app.listen(3000, () => {
  console.log('✅ Test server running on http://localhost:3000\n');
  
  // Run automated tests
  runTests();
});

// Automated test function
async function runTests() {
  const tests = [
    { method: 'GET', path: '/health', expected: 'Should be excluded from tracking' },
    { method: 'GET', path: '/api/users', expected: 'Should track GET /api/users' },
    { method: 'POST', path: '/api/users', expected: 'Should track POST /api/users' },
    { method: 'GET', path: '/api/users/123', expected: 'Should track GET /api/users/:id' },
    { method: 'DELETE', path: '/api/products/456', expected: 'Should track DELETE /api/products/:id' }
  ];

  console.log('🚀 Running automated tests...\n');

  for (const test of tests) {
    await makeRequest(test.method, test.path);
    console.log(`✓ ${test.method} ${test.path} - ${test.expected}`);
    await sleep(100); // Small delay between requests
  }

  console.log('\n📊 Test Results:');
  console.log('- All requests completed successfully');
  console.log('- Check console for tracking attempts');
  console.log('- Excluded /health should not appear in logs\n');

  console.log('💡 Next Steps:');
  console.log('1. Run mock tracking server: node mock-server.js');
  console.log('2. Run tests again to see actual tracking data\n');

  // Keep server running for manual testing
  console.log('🌐 Server is still running for manual testing...');
  console.log('   Try: curl http://localhost:3000/api/users');
  console.log('   Press Ctrl+C to stop\n');
}

function makeRequest(method, path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });

    if (method === 'POST') {
      req.write(JSON.stringify({ name: 'Test User' }));
    }

    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle exit
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test server...');
  testServer.close();
  process.exit(0);
});
