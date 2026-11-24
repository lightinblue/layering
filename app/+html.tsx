import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

/**
 * Web-only root HTML for `web.output: "static"` exports.
 * Dev / SPA (`web.output: "single"`, used by `npm run web`) uses Expo's
 * template instead — keep `single` so the entry `<script>` is injected.
 * Runs in Node — no DOM APIs here.
 */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#1991ff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0B0F14" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="포개" />
        <meta name="application-name" content="포개" />
        <meta
          name="description"
          content="포개 — 망각곡선 기반 복습 스케줄러 (모바일 웹)"
        />
        <title>포개</title>
        {/* Same asset as native AppIcon / assets/images/icon.png */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />

        {/*
          Disable body scrolling on web so ScrollView matches native.
        */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
html, body, #root {
  height: 100%;
}
body {
  margin: 0;
  background-color: #fff;
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #0B0F14;
  }
}
/* Phone-first shell: cap width on large screens so the UI stays a phone column. */
#root {
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
}
`;
