/* global console */
/**
 * Post-build script to create share.html with share-specific OG tags
 * Copies the built index.html and replaces meta tags for share link previews
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');

// Read the built index.html
const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');

// Meta tag replacements for share pages
const shareReplacements = [
  // Title
  [/<title>.*?<\/title>/, '<title>Someone sent you some Talking Docs</title>'],
  [/<meta name="title" content=".*?"/, '<meta name="title" content="Someone sent you some Talking Docs"'],

  // Description
  [/<meta name="description" content=".*?"/, '<meta name="description" content="Open to start a conversation with an AI that knows these documents inside out."'],

  // OG tags
  [/<meta property="og:title" content=".*?"/, '<meta property="og:title" content="Someone sent you some Talking Docs"'],
  [/<meta property="og:description" content=".*?"/, '<meta property="og:description" content="Open to start a conversation with an AI that knows these documents inside out."'],
  [/<meta property="og:image" content=".*?"/, '<meta property="og:image" content="https://conversational-docshare-frontend-production.up.railway.app/og-share.png"'],
  [/<meta property="og:site_name" content=".*?"/, '<meta property="og:site_name" content="Talking Docs by 33 Strategies"'],

  // Twitter tags
  [/<meta property="twitter:title" content=".*?"/, '<meta property="twitter:title" content="Someone sent you some Talking Docs"'],
  [/<meta property="twitter:description" content=".*?"/, '<meta property="twitter:description" content="Open to start a conversation with an AI that knows these documents inside out."'],
  [/<meta property="twitter:image" content=".*?"/, '<meta property="twitter:image" content="https://conversational-docshare-frontend-production.up.railway.app/og-share.png"'],
];

// Apply all replacements
let shareHtml = indexHtml;
for (const [pattern, replacement] of shareReplacements) {
  shareHtml = shareHtml.replace(pattern, replacement);
}

// Write share.html
writeFileSync(join(distDir, 'share.html'), shareHtml);

console.warn('Created dist/share.html with share-specific OG tags');
