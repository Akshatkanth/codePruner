/**
 * Mock Tracking Server
 * Simulates the CodePruner backend API for testing
 */

const http = require('http');

const trackedEndpoints = [];

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/track' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const authHeader = req.headers['authorization'];
        
        console.log('\n📊 Received tracking data:');
        console.log(`   Method: ${data.method}`);
        console.log(`   Route: ${data.route}`);
        console.log(`   Status: ${data.statusCode}`);
        console.log(`   Timestamp: ${data.timestamp}`);
        console.log(`   Latency: ${data.latency}ms`);
        console.log(`   Auth: ${authHeader}`);

        trackedEndpoints.push(data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Tracking received' }));
      } catch (error) {
        console.error('❌ Error parsing tracking data:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (req.url === '/stats' && req.method === 'GET') {
    // Stats endpoint to view all tracked data
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      total: trackedEndpoints.length,
      endpoints: trackedEndpoints
    }, null, 2));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 4000;

server.listen(PORT, () => {
  console.log('🎯 Mock CodePruner Tracking Server');
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log(`   POST http://localhost:${PORT}/track - Receive tracking data`);
  console.log(`   GET  http://localhost:${PORT}/stats - View tracked endpoints`);
  console.log('\n✅ Ready to receive tracking data!\n');
});

process.on('SIGINT', () => {
  console.log('\n\n📈 Final Statistics:');
  console.log(`   Total tracked requests: ${trackedEndpoints.length}`);
  
  if (trackedEndpoints.length > 0) {
    console.log('\n   Tracked endpoints:');
    const grouped = {};
    trackedEndpoints.forEach(ep => {
      const key = `${ep.method} ${ep.route}`;
      grouped[key] = (grouped[key] || 0) + 1;
    });
    
    Object.entries(grouped).forEach(([endpoint, count]) => {
      console.log(`   - ${endpoint}: ${count} calls`);
    });
  }
  
  console.log('\n👋 Shutting down...');
  server.close();
  process.exit(0);
});
