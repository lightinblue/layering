#!/usr/bin/env node
/**
 * Post-process `dist-web` for GitHub Pages (apex custom domain).
 * - Ensure CNAME + .nojekyll
 * - Inject Open Graph / Twitter meta into SPA index.html
 * - Copy index.html → 404.html (SPA deep-link fallback on Pages)
 * - Keep App Store legal pages at /legal/*
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist-web');
const DOMAIN = 'pogae-planner.site';
const SITE_URL = `https://${DOMAIN}/`;
const OG_TITLE = '포개';
const OG_DESCRIPTION =
  '오늘의 공부를 여섯 겹으로 포개요. 망각곡선에 맞춰 1·3·7·15·30·60일 복습.';
const OG_IMAGE = `${SITE_URL}og.png`;

function mustExist(file) {
  if (!fs.existsSync(file)) {
    console.error(`[prepare-web-dist] missing: ${file}`);
    process.exit(1);
  }
}

mustExist(DIST);
const indexPath = path.join(DIST, 'index.html');
mustExist(indexPath);

fs.writeFileSync(path.join(DIST, 'CNAME'), `${DOMAIN}\n`, 'utf8');
fs.writeFileSync(path.join(DIST, '.nojekyll'), '', 'utf8');

let html = fs.readFileSync(indexPath, 'utf8');

// Strengthen description if Expo left the short app.json one.
html = html.replace(
  /<meta name="description" content="[^"]*">/,
  `<meta name="description" content="${OG_DESCRIPTION}">`,
);

const ogBlock = `
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_URL}">
<meta property="og:title" content="${OG_TITLE}">
<meta property="og:description" content="${OG_DESCRIPTION}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${OG_TITLE}">
<meta name="twitter:description" content="${OG_DESCRIPTION}">
<meta name="twitter:image" content="${OG_IMAGE}">
`.trim();

if (!html.includes('property="og:title"')) {
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${ogBlock}\n</head>`);
  } else {
    console.error('[prepare-web-dist] no </head> in index.html');
    process.exit(1);
  }
} else {
  // Refresh OG/Twitter image + card if an older export already had tags.
  html = html
    .replace(
      /<meta property="og:image" content="[^"]*">/,
      `<meta property="og:image" content="${OG_IMAGE}">`,
    )
    .replace(
      /<meta name="twitter:card" content="[^"]*">/,
      `<meta name="twitter:card" content="summary_large_image">`,
    )
    .replace(
      /<meta name="twitter:image" content="[^"]*">/,
      `<meta name="twitter:image" content="${OG_IMAGE}">`,
    );
  if (!html.includes('property="og:image:width"')) {
    html = html.replace(
      `<meta property="og:image" content="${OG_IMAGE}">`,
      `<meta property="og:image" content="${OG_IMAGE}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">`,
    );
  }
}

fs.writeFileSync(indexPath, html, 'utf8');
fs.copyFileSync(indexPath, path.join(DIST, '404.html'));

const publicDir = path.join(ROOT, 'public');
const ogSrc = path.join(publicDir, 'og.png');
if (fs.existsSync(ogSrc)) {
  fs.copyFileSync(ogSrc, path.join(DIST, 'og.png'));
} else {
  console.error('[prepare-web-dist] missing public/og.png');
  process.exit(1);
}

const legalSrc = path.join(publicDir, 'legal');
const legalDest = path.join(DIST, 'legal');
if (fs.existsSync(legalSrc)) {
  fs.mkdirSync(legalDest, { recursive: true });
  for (const name of fs.readdirSync(legalSrc)) {
    fs.copyFileSync(path.join(legalSrc, name), path.join(legalDest, name));
  }
}

console.log(
  `[prepare-web-dist] ready: ${DOMAIN} CNAME, OG meta, 404.html SPA fallback, legal pages`,
);
