# ARUS Deployment Guide

Deploy ARUS to Render cloud hosting platform with PostgreSQL database.

---

## 🚀 Quick Deploy to Render

### Prerequisites

1. **GitHub Account** - Your ARUS code in a GitHub repository
2. **Render Account** - Sign up at https://render.com (free tier available)
3. **OpenAI API Key** (optional) - For AI-powered features

---

## Step-by-Step Deployment

### 1. Prepare Your Repository

Ensure your GitHub repository contains:

- ✅ `Dockerfile` - Production build configuration
- ✅ `scripts/build.sh` - Custom build script
- ✅ `.env.example` - Environment variable template

Push your latest code:

```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### 2. Create PostgreSQL Database

1. Login to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `arus-database`
   - **Region**: Choose closest to your users
   - **Plan**: Free (or paid for production)
4. Click **"Create Database"**
5. Wait for provisioning (2-3 minutes)
6. **Copy the Internal Database URL** (starts with `postgresql://`)

### 3. Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `arus-marine`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Runtime**: `Docker`
   - **Plan**: Free (or paid for production)

### 4. Configure Environment Variables

Click **"Environment"** tab and add:

```bash
# Database (use Internal Database URL from step 2)
DATABASE_URL=postgresql://arus_user:password@internal-host/arus

# Security (generate random secrets)
SESSION_SECRET=your_random_64_character_secret_here
ADMIN_TOKEN=your_secure_admin_token_here

# Optional: AI Features
OPENAI_API_KEY=sk-your-openai-api-key-here

# Node Environment
NODE_ENV=production
PORT=5000
```

**Generate Secure Secrets:**

```bash
# For SESSION_SECRET (run locally)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# For ADMIN_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Run `scripts/build.sh` (builds frontend + backend)
   - Start the Express server
   - Assign a public URL: `https://your-app.onrender.com`

**First deployment takes ~5-10 minutes**

### 6. Initialize Database

After deployment succeeds:

1. Open your app URL: `https://your-app.onrender.com`
2. The database schema will auto-initialize on first run
3. Login with your `ADMIN_TOKEN`

---

## 🔧 Configuration

### Custom Domain (Optional)

1. Go to **Settings** → **Custom Domain**
2. Add your domain (e.g., `arus.yourcompany.com`)
3. Update DNS records as shown
4. Render automatically provisions SSL certificate

### Scaling

**Free Tier:**

- 512 MB RAM
- Spins down after 15 min inactivity
- Startup time: ~30 seconds

**Starter Plan ($7/month):**

- Always on (no spin down)
- 512 MB RAM
- Custom domain included

**Standard Plan ($25/month):**

- 2 GB RAM
- High availability
- Better performance

### Database Backups

Render automatically backs up PostgreSQL:

- **Free tier**: Daily backups (7 day retention)
- **Paid plans**: Point-in-time recovery

Manual backup:

1. Go to database dashboard
2. Click **"Backups"**
3. Download `.sql` file

---

## 📊 Monitoring

### Application Logs

```bash
# View logs in Render dashboard
Services → arus-marine → Logs
```

Or use Render CLI:

```bash
render logs -s arus-marine
```

### Health Check

Render automatically monitors:

- HTTP health endpoint: `https://your-app.onrender.com/health`
- Auto-restart on crashes
- Email alerts on failures

### Metrics

Access at: `https://your-app.onrender.com/api/metrics`

---

## 🔐 Security

### Production Checklist

- ✅ Use strong `SESSION_SECRET` (64+ random characters)
- ✅ Use strong `ADMIN_TOKEN` (64+ random characters)
- ✅ Enable HTTPS (automatic on Render)
- ✅ Keep `OPENAI_API_KEY` secret
- ✅ Use Render's Internal Database URL (not external)
- ✅ Enable automatic security updates

### Environment Variables

**Never commit secrets to git:**

```bash
# .gitignore already includes:
.env
.env.local
.env.production
```

---

## 🚨 Troubleshooting

### Deployment Failed

**Check Build Logs:**

1. Go to **Events** tab
2. Click failed deployment
3. Review error messages

**Common Issues:**

- Missing dependencies: Check `package.json`
- Build script errors: Test `./scripts/build.sh` locally
- Docker errors: Verify `Dockerfile` syntax

### Database Connection Failed

**Verify:**

1. Database is running (green status)
2. `DATABASE_URL` uses **Internal Database URL**
3. Database region matches web service region

### App is Slow

**Free Tier Spin Down:**

- App sleeps after 15 min inactivity
- First request wakes it up (~30s)
- Upgrade to Starter plan for always-on

**Database Performance:**

- Free tier: 256 MB storage, 1 GB RAM
- Upgrade for better performance

### Can't Login

**Check Admin Token:**

1. Verify `ADMIN_TOKEN` in environment variables
2. Use exact value when logging in
3. No extra spaces or quotes

---

## 🔄 Updates & Maintenance

### Deploy New Version

1. Push changes to GitHub:

   ```bash
   git add .
   git commit -m "Update feature X"
   git push origin main
   ```

2. Render auto-deploys on push (if enabled)
3. Or manually deploy: **Manual Deploy** → **Deploy latest commit**

### Database Migrations

```bash
# Schema changes auto-apply via Drizzle ORM
# No manual migrations needed
```

### Rollback

1. Go to **Events** tab
2. Find previous successful deployment
3. Click **"Redeploy"**

---

## 💰 Costs

### Free Tier (Recommended for Testing)

- Web Service: Free (with limitations)
- PostgreSQL: Free (256 MB storage)
- **Total: $0/month**

### Production Setup

- Web Service: $7/month (Starter) or $25/month (Standard)
- PostgreSQL: $7/month (256 MB) to $25/month (1 GB)
- Custom domain: Included
- SSL certificates: Included
- **Total: ~$14-50/month**

---

## 📚 Resources

- **Render Docs**: https://render.com/docs
- **Render Status**: https://status.render.com
- **Support**: support@render.com

---

## ✅ Production Checklist

Before going live:

- [ ] Database created and running
- [ ] All environment variables configured
- [ ] Strong secrets generated
- [ ] Deployment successful (green status)
- [ ] Health check passing
- [ ] PWA installable on mobile/desktop
- [ ] Admin login works
- [ ] Monitoring configured
- [ ] Backups enabled
- [ ] Custom domain configured (optional)

**Ready to monitor your fleet!** 🚢
