# Deployment Guide

This guide explains how to deploy the Next.js frontend and Python backend with Playwright.

## Backend Deployment (Python/Playwright)

### Option 1: Railway.app (Recommended)
1. Go to [Railway.app](https://railway.app/)
2. Create a new project
3. Add a new service -> Deploy from GitHub repo
4. Select your repository and the `api` directory
5. Add these environment variables in Railway dashboard:
   - `PLAYWRIGHT_BROWSERS_PATH=0`
   - `PLAYWRIGHT_DOWNLOAD_HOST=1`
6. Add a custom domain (optional)

### Option 2: Render.com
1. Create a new Web Service
2. Connect your GitHub repository
3. Set the build command: `pip install -r requirements.txt && playwright install chromium && playwright install-deps`
4. Set the start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Set the environment to Python 3.9+
6. Add environment variables if needed

## Frontend Deployment (Next.js)

### Option 1: Vercel (Recommended)
1. Push your code to a GitHub repository
2. Go to [Vercel](https://vercel.com/)
3. Import your repository
4. In project settings, add an environment variable:
   - `NEXT_PUBLIC_API_URL`: Your backend URL (e.g., `https://your-railway-app.railway.app`)
5. Deploy!

### Option 2: Netlify
1. Push your code to a GitHub repository
2. Go to [Netlify](https://www.netlify.com/)
3. Import your repository
4. Set the build command: `npm run build`
5. Set the publish directory: `.next`
6. Add environment variables in site settings
7. Deploy!

## Local Development

1. Start the backend:
   ```bash
   cd api
   pip install -r requirements.txt
   playwright install chromium
   uvicorn main:app --reload
   ```

2. Start the frontend:
   ```bash
   npm install
   npm run dev
   ```

## Troubleshooting

- If you get Playwright errors, try running `npx playwright install` in the frontend directory
- Ensure your backend URL is correctly set in the frontend environment variables
- Check the browser console and network tabs for errors
- Make sure CORS is properly configured on your backend
