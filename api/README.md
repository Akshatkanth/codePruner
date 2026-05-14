# CodePruner API Server

Backend API for ingesting and storing endpoint usage logs.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
MONGODB_URI=mongodb://localhost:27017/codepruner
PORT=5000
NODE_ENV=development
```

### 3. Start MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or if you have MongoDB installed locally
mongod
```

### 4. Create Test Project

```bash
node create-project.js
```

This generates an API key you'll use in the SDK.

### 5. Start Server

```bash
npm start
# or with auto-reload
npm run dev
```

Server will be running on `http://localhost:5000`

## ☁️ Deploy to Render

1. Create a new Render Web Service from this repository.
2. Set the root directory to `api`, or import the included `render.yaml` blueprint.
3. Build command: `npm ci`
4. Start command: `npm start`
5. Add these environment variables in Render:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `CORS_ORIGINS`

Set `CORS_ORIGINS` to your full Netlify site URL, for example `https://your-site.netlify.app`.
Render injects `PORT` automatically, and the server already listens on `process.env.PORT`.

## 📡 API Endpoints

### Health Check

```bash
curl http://localhost:5000/health
```

### Track Endpoint Usage

```bash
curl -X POST http://localhost:5000/track \
  -H "Authorization: Bearer cp_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "GET",
    "route": "/api/users",
    "statusCode": 200,
    "timestamp": "2026-02-01T10:30:00.000Z",
    "latency": 45
  }'
```

**Or send array of logs:**

```bash
curl -X POST http://localhost:5000/track \
  -H "Authorization: Bearer cp_xxxxx" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "method": "GET",
      "route": "/api/users",
      "statusCode": 200,
      "latency": 45
    },
    {
      "method": "POST",
      "route": "/api/users",
      "statusCode": 201,
      "latency": 120
    }
  ]'
```

## 🔑 API Key Format

All tracking requests require:

```
Authorization: Bearer <API_KEY>
```

## 📊 Payload Format

### Single Object

```json
{
  "method": "GET",
  "route": "/api/users/:id",
  "statusCode": 200,
  "timestamp": "2026-02-01T10:30:00.000Z",
  "latency": 45
}
```

### Array of Objects

```json
[
  {
    "method": "GET",
    "route": "/api/users",
    "statusCode": 200,
    "latency": 25
  },
  {
    "method": "POST",
    "route": "/api/users",
    "statusCode": 201,
    "latency": 150
  }
]
```

### Required Fields

- `method`: HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- `route`: API route (e.g., `/api/users/:id`)
- `statusCode`: HTTP status code (100-599)

### Optional Fields

- `timestamp`: ISO 8601 format (defaults to now)
- `latency`: Response time in milliseconds (defaults to 0)

## ✅ Responses

### Success (202 Accepted)

```json
{
  "success": true,
  "message": "Accepted 5 log(s)",
  "count": 5
}
```

### Validation Error (400)

```json
{
  "error": "Item 0: Missing required field 'statusCode'"
}
```

### Unauthorized (401)

```json
{
  "error": "Invalid or inactive API key"
}
```

## 🗄️ Database

### Collections

- **projects** - Store API keys and project metadata
- **endpointlogs** - Store all endpoint usage logs

### Indexes

- `projects.apiKeyHash` - For API key lookup (SHA-256 hash)
- `endpointlogs.projectId + route` - For querying endpoints
- `endpointlogs.projectId + timestamp` - For time-based queries

## 🎯 Design Principles

✅ Fast ingestion (returns 202 immediately)
✅ No heavy processing
✅ Batch inserts
✅ Simple validation
✅ No retries
✅ Fire and forget

## 🧪 Testing

```bash
# Start server
npm start

# In another terminal, create a project
node create-project.js

# Use the API key to make requests
curl -X POST http://localhost:5000/track \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"method":"GET","route":"/test","statusCode":200}'
```

## 🔒 Security Notes

- API keys stored in MongoDB (hashed in production)
- Authorization header required for all tracking endpoints
- Validate all payloads before insertion
- Rate limiting not implemented (add with express-rate-limit if needed)
