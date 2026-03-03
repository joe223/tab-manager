const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const buildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-prod');
const srcDir = path.join(__dirname, '..', 'src');

async function buildPages() {
  await esbuild.build({
    entryPoints: [path.join(srcDir, 'app.tsx')],
    bundle: true,
    outfile: path.join(buildDir, 'options.js'),
    platform: 'browser',
    target: 'chrome110',
    format: 'iife',
    jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });

  const htmlContent = `<!DOCTYPE html><html><head><title>Tab Manager</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body> <div id="__plasmo"></div> <script src="/options.js" defer></script> </body></html>`;
  fs.writeFileSync(path.join(buildDir, 'options.html'), htmlContent);

  console.log('Options page built successfully');
}

buildPages().catch(console.error);
