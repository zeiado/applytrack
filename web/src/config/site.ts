// The public address of the web app, for links that must be absolute (the sitemap).
// NEXT_PUBLIC_SITE_URL wins; on Vercel the production domain is known; else local.
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")
).replace(/\/$/, "");
