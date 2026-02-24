# Ankh Client App
## Deployment
- **Recommended stack**: Deploy the Next.js app on Vercel and use a managed Postgres (Supabase, Neon, Railway, Render, or an existing Postgres instance). Prisma connects via `DATABASE_URL`.
- **Environment variables**: In your hosting provider, add `DATABASE_URL` and any secrets (e.g., `NEXTAUTH_SECRET`, SMTP keys). Do not commit secrets.
- **Prisma migrations**: Run migrations against the production DB before/at first deploy.

### Vercel Setup (App) + Postgres (DB)
1. Provision a production Postgres database (e.g., Supabase/Neon) and copy its connection string.
2. Apply migrations to the prod DB:
	 - Export your prod `DATABASE_URL` and run:
		 ```bash
		 export DATABASE_URL="postgres://user:pass@host:port/dbname"
		 npx prisma migrate deploy --schema prisma/schema.prisma
		 ```
3. In Vercel, import this repo and set environment variables (`DATABASE_URL`, other secrets) in Project Settings → Environment Variables.
4. Build command: Vercel defaults to `npm run build`. If you keep the generated Prisma client in the repo, set env `PRISMA_SKIP_POSTINSTALL_GENERATE=true`. If you prefer generating on install, add `"postinstall": "prisma generate"` in `package.json` and do not commit the generated client.
5. Deploy and verify.

### Alternative: Docker + Fly.io/Railway/Render
- Configure `next.config.ts` with `output: 'standalone'`.
- Create a Dockerfile, build the image, deploy to your host, and set `DATABASE_URL`.
- Run `npx prisma migrate deploy` as a release task/job against the prod DB.

### Notes
- Prisma client is Node runtime only; avoid Edge functions for DB access.
- Generated Prisma client under `src/generated/` is excluded from lint via `.eslintignore`.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
