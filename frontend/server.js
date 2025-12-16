/* global process, console */
/* eslint-disable no-console */
/**
 * Express server for SPA with dynamic OG meta tags for social media crawlers.
 *
 * Problem: Social media crawlers don't execute JavaScript, so they don't see
 * client-side meta tag updates (react-helmet, etc).
 *
 * Solution: Detect crawlers via user-agent and inject share-specific meta tags
 * into the HTML before serving it.
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { isbot } from 'isbot';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Path to built SPA
const buildPath = path.join(__dirname, 'dist');
const indexPath = path.join(buildPath, 'index.html');

// Base URL for production
const BASE_URL = process.env.BASE_URL || 'https://conversational-docshare-frontend-production.up.railway.app';

// Share-specific meta tags
const SHARE_META = {
  title: 'Someone sent you some Talking Docs',
  description: 'Click to view an AI-powered document experience crafted just for you.',
  image: `${BASE_URL}/og-share.png`,
};

/**
 * Generate share-specific meta tag HTML
 */
function generateShareMetaTags(projectId) {
  const url = `${BASE_URL}/share/${projectId}`;
  return `
    <title>${SHARE_META.title}</title>
    <meta name="title" content="${SHARE_META.title}" />
    <meta name="description" content="${SHARE_META.description}" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${SHARE_META.title}" />
    <meta property="og:description" content="${SHARE_META.description}" />
    <meta property="og:image" content="${SHARE_META.image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="33 Strategies" />

    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${url}" />
    <meta property="twitter:title" content="${SHARE_META.title}" />
    <meta property="twitter:description" content="${SHARE_META.description}" />
    <meta property="twitter:image" content="${SHARE_META.image}" />`;
}

/**
 * Replace existing meta tags with share-specific ones
 */
function injectShareMetaTags(html, projectId) {
  const shareMeta = generateShareMetaTags(projectId);

  // Remove existing OG and Twitter meta tags, title, and description
  let modifiedHtml = html
    // Remove title tag
    .replace(/<title>.*?<\/title>/s, '')
    // Remove meta name="title"
    .replace(/<meta\s+name="title"[^>]*>/gi, '')
    // Remove meta name="description"
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    // Remove all og: meta tags
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, '')
    // Remove all twitter: meta tags
    .replace(/<meta\s+property="twitter:[^"]*"[^>]*>/gi, '');

  // Inject share meta tags after viewport meta tag
  modifiedHtml = modifiedHtml.replace(
    /(<meta\s+name="viewport"[^>]*>)/i,
    `$1\n    ${shareMeta}`
  );

  return modifiedHtml;
}

// Serve static assets (JS, CSS, images) with caching
app.use(express.static(buildPath, {
  maxAge: '1y',
  immutable: true,
  index: false, // Don't auto-serve index.html for directories
}));

// Handle /share/:projectId routes - inject meta tags for crawlers
app.get('/share/:projectId', (req, res) => {
  const userAgent = req.get('user-agent') || '';
  const isCrawler = isbot(userAgent);

  // Read the built index.html
  const html = fs.readFileSync(indexPath, 'utf8');

  if (isCrawler) {
    // Inject share-specific meta tags for crawlers
    const modifiedHtml = injectShareMetaTags(html, req.params.projectId);
    res.send(modifiedHtml);
    console.log(`[Crawler] Served share page with OG tags: ${req.params.projectId} (${userAgent.slice(0, 50)}...)`);
  } else {
    // Serve normal SPA for browsers
    res.send(html);
  }
});

// Fallback: Serve index.html for all other routes (SPA routing)
// Express 5.x requires named wildcard parameters
app.use((req, res) => {
  // Skip if requesting a file with extension (already handled by static middleware)
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(indexPath);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Serving static files from: ${buildPath}`);
});
