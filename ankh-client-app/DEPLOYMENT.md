# Deployment Guide

## Prerequisites
- Git repository pushed to GitHub
- Supabase database configured and migrations applied ✅
- Vercel account (free tier works)

## Deploy to Vercel (Recommended)

### Option 1: Quick Deploy via Web UI

1. **Go to [Vercel](https://vercel.com)** and sign in with GitHub

2. **Click "Add New Project"** → Import your GitHub repository

3. **Configure Environment Variables** (copy from `.env.production.example`):
   ```
   DATABASE_URL = postgresql://postgres.upuubmohuazjrogakrwa:Ankhclientdb123@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
   
   DIRECT_URL = postgresql://postgres.upuubmohuazjrogakrwa:Ankhclientdb123@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
   
   JWT_SECRET = [Generate a strong random secret]
   
   NODE_ENV = production
   ```

4. **Build Settings** (auto-detected for Next.js):
   - Framework Preset: `Next.js`
   - Build Command: `next build`
   - Output Directory: `.next`
   - Install Command: `npm install`

5. **Click "Deploy"** 🚀

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (it will prompt for configuration)
vercel

# For production deployment
vercel --prod
```

## Important Post-Deployment Steps

### 1. Generate a Strong JWT Secret
```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Add this to your Vercel environment variables as `JWT_SECRET`

### 2. Verify Database Connection
After deployment, check your Vercel logs to ensure the database connects successfully.

### 3. Seed the Database (if needed)
```bash
# Run locally with production DATABASE_URL
DATABASE_URL="your_supabase_url" npm run seed
```

## Alternative Deployment Options

### Deploy to Railway
1. Connect GitHub repository
2. Add environment variables
3. Deploy automatically

### Deploy to Render
1. New Web Service → Connect repository
2. Build Command: `npm install && npx prisma generate && npm run build`
3. Start Command: `npm start`
4. Add environment variables

## Troubleshooting

### Build Fails with Prisma Error
Add build command that includes Prisma generation:
```bash
npx prisma generate && npm run build
```

### Database Connection Timeout
- Check if Supabase project is active (not paused)
- Verify environment variables are set correctly
- Ensure you're using the connection pooler URL (port 6543)

### JWT Errors
- Make sure `JWT_SECRET` is set in production environment
- Should be different from development secret

## Monitoring

- **Vercel Dashboard**: Check deployment logs and analytics
- **Supabase Dashboard**: Monitor database usage and queries
- Set up error tracking (Sentry recommended)

## Domain Configuration

Once deployed:
1. Go to Vercel project settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

---

Your app is now live! 🎉
