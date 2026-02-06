# Razorpay Integration Setup Guide

Your SaaS backend is now ready for Razorpay payments! Follow these steps to complete the integration.

## Step 1: Get Razorpay API Keys

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/app/settings/api-keys)
2. Login with your Razorpay account (create one if needed)
3. Copy your **Key ID** (public key)
4. Copy your **Key Secret** (keep this secret!)

## Step 2: Create a Razorpay Plan

1. Go to [Razorpay Plans](https://dashboard.razorpay.com/app/plans)
2. Create a new plan:
  - **Amount**: 100000 (₹1000.00 in rupees, or equivalent in your currency)
   - **Period**: monthly
   - **Interval**: 1
3. Copy the **Plan ID** (format: `plan_xxxxx`)

## Step 3: Configure Webhook

1. Go to [Webhooks Settings](https://dashboard.razorpay.com/app/webhooks)
2. Add a new webhook:
   - **URL**: `http://your-domain.com/billing/webhook`
   - **Active**: Yes
   - **Select Events**: Check `subscription.activated` and `subscription.cancelled`
3. Copy the **Webhook Secret**

For local testing, you can use [ngrok](https://ngrok.com) to expose your localhost:
```bash
ngrok http 5000
# Then use: https://xxxx-yy-zzz.ngrok.io/billing/webhook
```

## Step 4: Add Credentials to .env

Edit `.env` file and update:

```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_PLAN_ID=your_razorpay_plan_id
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
WEBHOOK_URL=http://your-domain.com/billing/webhook
```

## Step 5: Test the Integration

### Create a Subscription

```bash
# Get a valid JWT token first (from login)
TOKEN="your_jwt_token"

curl -X POST http://localhost:5000/billing/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "subscription": {
    "id": "sub_xxxxx",
    "status": "created",
    "plan_id": "plan_xxxxx"
  },
  "razorpayKey": "rzp_live_xxxxx"
}
```

### Test Webhook (Razorpay Dashboard)

1. Go to Webhooks → Your webhook → Test
2. Select `subscription.activated` event
3. Click "Send"
4. Check server logs to see if user plan was upgraded to "pro"

## API Endpoints

### POST /billing/subscribe
Creates a Razorpay subscription for the logged-in user.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_xxxxx",
    "status": "created",
    "plan_id": "plan_xxxxx"
  },
  "razorpayKey": "rzp_live_xxxxx"
}
```

### POST /billing/webhook
Handles Razorpay webhook events. **This endpoint should NOT be called manually.**

**Events Handled:**
- `subscription.activated` → Upgrades user to pro plan
- `subscription.cancelled` → Downgrades user to free plan

## Frontend Integration (Next.js)

Create a billing page component:

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function BillingPage() {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/billing/subscribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Open Razorpay checkout
        const options = {
          key: data.razorpayKey,
          subscription_id: data.subscription.id,
          name: 'CodePruner Pro',
          description: 'Unlimited projects and endpoints',
          handler: (response) => {
            alert('Upgrade successful!');
            window.location.href = '/dashboard';
          },
          prefill: {
            email: localStorage.getItem('email') || ''
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleUpgrade} disabled={loading}>
      {loading ? 'Processing...' : 'Upgrade to Pro - ₹1000/month'}
    </button>
  );
}
```

## Troubleshooting

### "Invalid signature" error in webhook

- Verify `RAZORPAY_WEBHOOK_SECRET` is correct
- Make sure the webhook URL matches exactly in Razorpay dashboard

### "Failed to create subscription" error

- Check `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are correct
- Verify `RAZORPAY_PLAN_ID` exists in your Razorpay dashboard
- Check server logs for detailed error messages

### Webhook not being received

- Ensure webhook URL is publicly accessible (use ngrok for local testing)
- Check webhook is enabled in Razorpay dashboard
- Verify correct events are selected (subscription.activated, subscription.cancelled)

## Production Checklist

- [ ] Switch to production API keys (Razorpay dashboard)
- [ ] Add secure domain to CORS whitelist
- [ ] Set up proper error logging and monitoring
- [ ] Test end-to-end upgrade flow with real payment
- [ ] Add email notifications on successful upgrade
- [ ] Document support process for subscription issues
- [ ] Set up backup webhook URL for redundancy
