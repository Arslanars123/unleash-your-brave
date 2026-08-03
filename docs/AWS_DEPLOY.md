# AWS deploy guide — backend + admin dashboard (separate) + GHL webhook

This project deploys as **two separate apps**:

| App | Suggested AWS service | Public URL example |
| --- | --- | --- |
| Backend API | **App Runner** (from Docker image) or EC2 | `https://api.yourdomain.com` |
| Admin dashboard | **Amplify Hosting** or S3 + CloudFront | `https://admin.yourdomain.com` |

GHL webhooks must call the **backend**, not the dashboard:

```text
https://api.yourdomain.com/api/v1/webhooks/ghl
```

> Note: the API persists data in **MongoDB**. Set `MONGODB_URI` in App Runner
> (Atlas recommended). Redeploying no longer wipes attendees/events/sessions.

---

## 1. Deploy backend (App Runner)

### Build & push image

From `backend/`:

```bash
# Build
docker build -t unleash-backend .

# Tag for ECR (replace ACCOUNT and REGION)
aws ecr create-repository --repository-name unleash-backend --region us-east-1
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
docker tag unleash-backend:latest ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/unleash-backend:latest
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/unleash-backend:latest
```

### App Runner service env vars

Set these in App Runner (or your host):

```env
NODE_ENV=production
PORT=4000
LOG_LEVEL=info
CORS_ORIGINS=https://admin.yourdomain.com
JWT_ACCESS_SECRET=<at-least-32-random-chars>
JWT_REFRESH_SECRET=<different-32-random-chars>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
GHL_WEBHOOK_SECRET=<long-random-secret>
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/unleash_your_brave
```

Health check path: `/health`

After deploy, confirm:

```bash
curl https://YOUR_API_URL/health
```

### Test webhook

```bash
curl -X POST https://YOUR_API_URL/api/v1/webhooks/ghl \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: YOUR_GHL_WEBHOOK_SECRET' \
  -d '{
    "email": "buyer@example.com",
    "name": "Test Buyer",
    "contactId": "abc123",
    "product": "Test product",
    "amount": "0"
  }'
```

You should get `success: true` and a created/updated member. In the dashboard
**Attendees** list, that email should appear after login.

---

## 2. Deploy admin dashboard (Amplify)

1. Push this repo to GitHub (or connect Amplify to the repo).
2. Create an Amplify app → select the `dashboard/` folder as the app root  
   (or use the included [`dashboard/amplify.yml`](../dashboard/amplify.yml)).
3. Add environment variable:

```env
VITE_API_BASE_URL=https://YOUR_API_URL/api/v1
```

4. Build settings use `amplify.yml` (npm ci → npm run build → `dist/`).
5. After deploy, open the Amplify URL and log in with your admin account.

Also add that Amplify URL to backend `CORS_ORIGINS`.

---

## 3. Point GoHighLevel at your API

In your **Payment Received** workflow → Webhook action:

| Setting | Value |
| --- | --- |
| Method | `POST` |
| URL | `https://YOUR_API_URL/api/v1/webhooks/ghl` |
| Custom data | `email`, `name`, `contactId`, `product`, `amount` (as you mapped) |
| Header (recommended) | `x-webhook-secret: YOUR_GHL_WEBHOOK_SECRET` |

In GHL webhook **Headers** section, add:

- Key: `x-webhook-secret`
- Value: same as `GHL_WEBHOOK_SECRET`

Publish the workflow, place another $0 test order, then check:

1. GHL **Execution logs** → success  
2. API logs → `GHL purchase webhook processed`  
3. Dashboard → **Attendees** → new/updated buyer

---

## Quick local tunnel (before AWS)

If you want to test the webhook before AWS is live:

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
npx cloudflared tunnel --url http://localhost:4000
```

Use the tunnel URL in GHL:

`https://xxxx.trycloudflare.com/api/v1/webhooks/ghl`
