#!/usr/bin/env bash
# Assembles the public site into dist/ for Cloudflare Pages. Only public files are copied, so
# docs/, netlify/, README and package.json are not served (docs/* returns the 404 page, as on Netlify).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
cp ./*.html sold.json dist/
cp -r images dist/
cp cloudflare/_headers cloudflare/_routes.json dist/
npx --yes esbuild@0.25 cloudflare/worker.js --bundle --format=esm --platform=neutral --external:cloudflare:sockets --outfile=dist/_worker.js --log-level=warning
