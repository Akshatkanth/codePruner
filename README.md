# CodePruner SDK

Lightweight Node.js SDK for tracking API endpoint usage in Express applications. Identifies unused endpoints to reduce technical debt.

## 🚀 Features

- **Low Overhead**: <2ms latency per request
- **Non-Blocking**: Asynchronous tracking that never slows down your app
- **Safe**: Never crashes your host application
- **Configurable**: Easy ENV-based configuration
- **Flexible**: Exclude health checks and metrics endpoints

## 📦 Installation

```bash
npm install express
```

## 🔧 Quick Start

```javascript
const express = require('express');
const CodePruner = require('./middleware');

const app = express();

// Initialize CodePruner
const codePruner = new CodePruner({
  apiKey: process.env.CP_API_KEY,
  apiEndpoint: 'https://api.codepruner.com/track',
  excludedRoutes: ['/health', '/metrics']
});

// Apply middleware
app.use(codePruner.middleware());

// Your routes...
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

## ⚙️ Configuration

### Options

```javascript
new CodePruner({
  apiKey: 'your-api-key',           // Required: Your CodePruner API key
  apiEndpoint: 'https://...',       // Optional: Custom tracking endpoint
  enabled: true,                    // Optional: Enable/disable tracking
  excludedRoutes: ['/health'],      // Optional: Routes to exclude
  debug: false                      // Optional: Enable debug logging
})
```

### Environment Variables

```bash
CP_API_KEY=your-api-key           # Your API key
CP_API_ENDPOINT=https://...       # Custom endpoint (optional)
CP_ENABLED=true                   # Enable/disable tracking
NODE_ENV=production               # Disables debug logs
```

## 📊 What Gets Tracked

- **HTTP Method**: GET, POST, PUT, DELETE, etc.
- **Route Path**: `/api/users/:id` (uses `req.route.path`)
- **Status Code**: 200, 404, 500, etc.
- **Timestamp**: ISO 8601 format
- **Latency**: Request duration in ms

## 🎯 Use Cases

### Disable in Development

```bash
CP_ENABLED=false npm run dev
```

### Custom Event Tracking

```javascript
codePruner.track({
  event: 'custom_event',
  method: 'POST',
  route: '/api/checkout',
  statusCode: 200
});
```

### Exclude Routes

```javascript
const codePruner = new CodePruner({
  excludedRoutes: [
    '/health',
    '/metrics',
    '/readyz',
    '/livez'
  ]
});
```

## 🔒 Security

- API key sent via `Authorization: Bearer` header
- No sensitive data logged in production
- All errors handled silently to prevent crashes
- Request timeout: 5 seconds

## 📈 Performance

- **Latency**: <2ms overhead per request
- **Async**: Uses `setImmediate()` for non-blocking I/O
- **No Retries**: Fire-and-forget approach
- **Memory Efficient**: Response streams drained immediately

## 🛠️ Development

Run the example app:

```bash
npm start
```

With debug logging:

```bash
NODE_ENV=development npm start
```

## 📝 Example Response

The SDK sends data to your tracking endpoint in this format:

```json
{
  "method": "GET",
  "route": "/api/users/:id",
  "statusCode": 200,
  "timestamp": "2026-01-30T10:30:00.000Z",
  "latency": 45
}
```

## 🤝 Contributing

This is an MVP. Contributions welcome!

## 📄 License

MIT
