# DJOURNAL CAPTION STUDIO

Vision-first AI caption generator built with React + Vite and deployed with Vercel.

## Run locally

1. Install Node.js 18+.
2. Run:

```bash
npm install
npm run dev
```

## Gemini API key

The browser does NOT contain the Gemini API key. Requests go through `/api/gemini`.

For local development, create `.env.local`:

```env
GEMINI_API_KEY=your_real_key
```

For Vercel, add `GEMINI_API_KEY` under Project Settings → Environment Variables.

## Deploy

Push this project to GitHub, import the repository into Vercel, add `GEMINI_API_KEY`, and deploy.
