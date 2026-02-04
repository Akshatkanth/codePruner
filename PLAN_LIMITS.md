# Plan-Based Limits Implementation

## Overview
CodePruner now enforces plan-based usage limits for Free and Pro tiers. This system prevents abuse and encourages users to upgrade.

---

## 1. User Model Updates

**File:** `api/models.js`

Added `plan` field to User schema:
```javascript
plan: {
  type: String,
  enum: ['free', 'pro'],
  default: 'free',
  index: true
}
```

- **Default:** All new users start on the Free plan
- **Values:** `'free'` or `'pro'`
- **Indexed:** For efficient lookups

---

## 2. Project Creation Limits

**File:** `api/server.js` - POST `/projects` endpoint

### Free Plan
- **Limit:** Maximum 1 project per user
- **Error Response:** HTTP 403
```json
{
  "error": "Free plan limited to 1 project. Upgrade to Pro for unlimited projects."
}
```

### Pro Plan
- **Limit:** Unlimited projects

**Implementation:**
```javascript
if (user.plan === 'free') {
  const projectCount = await Project.countDocuments({ owner: userId });
  if (projectCount >= 1) {
    return res.status(403).json({ 
      error: 'Free plan limited to 1 project. Upgrade to Pro for unlimited projects.' 
    });
  }
}
```

---

## 3. Endpoint Tracking Limits

**File:** `api/server.js` - POST `/track` endpoint

### Free Plan
- **Limit:** Maximum 50 unique endpoints per project
- **Behavior:** New endpoints beyond the limit are silently ignored (no error)
- **Logging:** Console warning logged when limit exceeded

### Pro Plan
- **Limit:** Unlimited unique endpoints

**Implementation:**
- Queries `EndpointLog` for existing unique routes using `.distinct('route')`
- Filters incoming requests to only allow new routes up to the 50 limit
- Existing routes can always be logged (calls to existing endpoints are never blocked)
- Graceful degradation: Requests aren't rejected, excess endpoints are just skipped

**Example:**
```javascript
const currentEndpoints = await EndpointLog.distinct('route', { projectId });
// If user has 49 endpoints and sends 3 new routes, only 1 new route is allowed
```

---

## 4. Data Retention Policies

**File:** `api/cron-analyzer.js`

### Free Plan
- **Retention:** 30 days
- **Behavior:** Logs older than 30 days are automatically deleted daily at 2 AM

### Pro Plan
- **Retention:** 90 days
- **Behavior:** Logs older than 90 days are automatically deleted daily at 2 AM

**Implementation:**
New `cleanOldLogs()` function runs before daily analysis:

```javascript
async function cleanOldLogs() {
  const projects = await Project.find({ active: true }).populate('owner');
  
  for (const project of projects) {
    const retentionDays = project.owner.plan === 'pro' ? 90 : 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    await EndpointLog.deleteMany({
      projectId: project._id,
      timestamp: { $lt: cutoffDate }
    });
  }
}
```

**Log Cleanup Schedule:**
1. Daily at 2:00 AM, the cron job runs
2. First: Deletes old logs based on user plan
3. Then: Analyzes remaining endpoints

---

## Testing the Limits

### Test Free Plan Project Limit
```bash
# Create first project - should succeed
curl -X POST http://localhost:5000/projects \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Project 1"}'

# Create second project - should fail with 403
curl -X POST http://localhost:5000/projects \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Project 2"}'
# Response: {"error": "Free plan limited to 1 project..."}
```

### Test Free Plan Endpoint Limit
```bash
# After creating 50 unique endpoints, the 51st will be silently ignored
# Check the server logs for warnings when limit is exceeded
```

### Test Data Retention
```bash
# Monitor logs in MongoDB directly
db.endpointlogs.find({ timestamp: { $lt: new Date(Date.now() - 30*24*60*60*1000) } })
# For free users, logs older than 30 days are deleted at 2 AM daily
```

---

## Constraints Met

✅ No payment logic - Just enforces limits  
✅ No UI changes - Backend-only implementation  
✅ Simple and readable - Clear logic flow  
✅ Non-breaking - Graceful degradation (excess endpoints ignored, not rejected)  
✅ Efficient - Uses indexes for fast queries, deferred cleanup via cron  

---

## Future Enhancements

When ready to monetize, you can:
1. Add a `Subscription` model tracking payment status
2. Create a `/upgrade` endpoint to change user plan
3. Send emails notifying users when they approach limits
4. Add analytics dashboard showing usage vs. limits

