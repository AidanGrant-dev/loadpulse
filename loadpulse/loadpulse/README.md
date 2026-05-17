# LoadPulse — Deployment Guide

## Files in this project

```
loadpulse/
├── vercel.json          ← Vercel routing config
├── package.json         ← Node config
├── .env.example         ← Environment variables template
├── api/
│   ├── strava.js        ← Strava token exchange + data API
│   └── whoop.js         ← Whoop token exchange + data API
└── public/
    ├── index.html       ← Main dashboard
    └── callback.html    ← OAuth redirect catcher
```

---

## Step 1 — Upload to GitHub

1. Go to github.com and click the **+** icon → **New repository**
2. Name it `loadpulse`, set it to **Private**, click **Create repository**
3. Click **uploading an existing file**
4. Drag ALL the files and folders into the upload area
   - vercel.json
   - package.json
   - .env.example
   - The `api` folder (both .js files)
   - The `public` folder (index.html + callback.html)
5. Click **Commit changes**

---

## Step 2 — Deploy on Vercel

1. Go to vercel.com and click **Add New Project**
2. Click **Import** next to your `loadpulse` repository
3. Leave all settings as default, click **Deploy**
4. Wait ~60 seconds — you'll get a URL like `https://loadpulse-abc123.vercel.app`

---

## Step 3 — Add your secrets (IMPORTANT)

In Vercel dashboard → your project → **Settings** → **Environment Variables**, add:

| Name | Value |
|------|-------|
| `STRAVA_CLIENT_ID` | `246327` |
| `STRAVA_CLIENT_SECRET` | Your Strava client secret |
| `WHOOP_CLIENT_ID` | `abdb106b-148b-45c9-9eb4-959b0adeb8c0` |
| `WHOOP_CLIENT_SECRET` | Your Whoop client secret |
| `WHOOP_REDIRECT_URI` | `https://your-app.vercel.app/callback.html` |

Then go to **Deployments** → click the three dots on the latest deployment → **Redeploy** so the secrets take effect.

---

## Step 4 — Update redirect URIs

**Strava** (`strava.com/settings/api`):
- Authorization Callback Domain: `your-app.vercel.app`

**Whoop** (developer portal):
- Redirect URI: `https://your-app.vercel.app/callback.html`

---

## Step 5 — Connect your apps

Open your Vercel URL, go to **Connections**, and reconnect Strava and Whoop.
This time the callback page will automatically send the code back — no manual copying needed.

---

## Finding your client secrets

**Strava:** `strava.com/settings/api` → your app → **Client Secret** (click show)

**Whoop:** Whoop developer portal → your app → **Client Secret**
