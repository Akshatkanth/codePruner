# CodePruner Dashboard

Next.js dashboard to visualize unused API endpoints.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Configure Dashboard

Enter your:
- **Project ID**: Get from `node create-project.js`
- **API Key**: Your CodePruner API key

## 📊 Features

✅ Real-time endpoint monitoring
✅ Color-coded status (Dead/Risky/Active)
✅ Relative time display (e.g., "2h ago")
✅ Auto-refresh every 30 seconds
✅ Summary statistics
✅ Responsive table view

## 🎨 Status Colors

- 🔴 **Red (Dead)**: 0 calls in last 60 days
- 🟡 **Yellow (Risky)**: <5 calls in last 60 days
- 🟢 **Green (Active)**: 5+ calls in last 60 days

## 🏗️ Production Build

```bash
npm run build
npm start
```

## ☁️ Deploy to Netlify

1. Create a new site in Netlify and select the repo.
2. Set the base directory to `dashboard`.
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Add environment variable `NEXT_PUBLIC_API_BASE_URL` and set it to your Render backend URL.

## 📝 Requirements

- Node.js 18+
- CodePruner API available at your Render URL
- Valid Project ID and API Key

## 🔗 API Endpoint

Dashboard fetches from:
```
GET https://your-render-service.onrender.com/projects/:projectId/endpoints
```

## 🛠️ Tech Stack

- Next.js 14
- React 18
- TypeScript
- CSS Modules
