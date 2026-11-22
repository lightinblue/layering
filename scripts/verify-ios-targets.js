#!/usr/bin/env node
/**
 * Guardrail for local Xcode Archive.
 *
 * Tip prebuild must produce only `layering` + `todayreview`.
 * `HelloWorld` comes from `@bacons/apple-targets/prebuild-blank.tgz`
 * (dev-only RN-free template) — never use that template for TestFlight.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const iosDir = path.join(root, 'ios');

function fail(msg) {
  console.error(`verify-ios-targets: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(iosDir)) {
  fail('ios/ missing — run `npm run prebuild:ios:clean` first.');
}

const helloPaths = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === 'Pods' || entry.name === 'build' || entry.name === 'DerivedData') {
      continue;
    }
    if (/helloworld/i.test(entry.name)) {
      helloPaths.push(path.relative(root, full));
    }
    if (entry.isDirectory()) walk(full);
  }
}
walk(iosDir);

if (helloPaths.length) {
  fail(
    `HelloWorld paths found under ios/:\n  - ${helloPaths.join('\n  - ')}\n` +
      'Remove ios/ and re-run `npm run prebuild:ios:clean` (do NOT pass ' +
      '`--template …/prebuild-blank.tgz`).',
  );
}

const pbxFiles = [];
function findPbx(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === 'Pods') continue;
    if (entry.isDirectory()) findPbx(full);
    else if (entry.name === 'project.pbxproj') pbxFiles.push(full);
  }
}
findPbx(iosDir);

if (!pbxFiles.length) {
  fail('No project.pbxproj under ios/.');
}

const required = ['layering', 'todayreview'];
for (const pbx of pbxFiles) {
  const text = fs.readFileSync(pbx, 'utf8');
  if (/HelloWorld/.test(text)) {
    fail(
      `${path.relative(root, pbx)} still references HelloWorld. ` +
        'Close Xcode, `rm -rf ios`, then `npm run prebuild:ios:clean`.',
    );
  }
  for (const name of required) {
    if (!new RegExp(`PBXNativeTarget "${name}"`).test(text) && !text.includes(`productName = ${name};`)) {
      fail(
        `${path.relative(root, pbx)} missing target "${name}". ` +
          'Expected app `layering` + widget `todayreview` after tip prebuild.',
      );
    }
  }
}

console.log(
  'verify-ios-targets: ok — targets layering + todayreview, no HelloWorld.',
);
