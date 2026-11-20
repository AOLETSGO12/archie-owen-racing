# Cloudflare Pages hosting

Since 20 Nov 2026 the site is hosted on Cloudflare Pages (project `archie-owen-racing`,
https://archie-owen-racing.pages.dev). The Netlify site is left in place, untouched, as a fallback.

- **Deploys:** these are direct uploads, so merging to `main` does **not** deploy by itself yet. After a merge, run
  `./cloudflare/build.sh && npx wrangler pages deploy --branch=main` from a checkout of `main` (needs
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`). For a preview, use `--branch=<name>`, which gives
  `https://<name>.archie-owen-racing.pages.dev`. To deploy on every merge, copy
  `cloudflare/github-actions-deploy.yml` to `.github/workflows/` and add those two repository secrets.
  That has to be done by someone whose GitHub login has the `workflow` scope.
- **What gets published:** `cloudflare/build.sh` copies only the public files (HTML, `images/`,
  `sold.json`) into `dist/`. `docs/`, `netlify/`, `README.md` and `package.json` are not served.
- **Functions:** `cloudflare/worker.js` (built to `dist/_worker.js`) serves the same URLs as the
  Netlify Functions, so nothing outside the site needs changing:
  - `GET /.netlify/functions/availability` returns `{ "sold": [...] }`
  - `POST /.netlify/functions/stripe-webhook` is the endpoint registered in Stripe
  `_routes.json` limits the worker to `/.netlify/functions/*`; everything else is static.
- **Storage:** Workers KV namespace `archie-owen-racing-sponsorship` (binding `SPONSORSHIP`)
  replaces the Netlify Blobs store `sponsorship`. Keys `sold` and `emailed` were copied over
  on 20 Nov 2026. `sold.json` manual overrides work as before.
- **Settings (Cloudflare → Workers & Pages → archie-owen-racing → Settings → Variables and secrets):**
  `STRIPE_WEBHOOK_SECRET` (secret), `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASS` (secret), optional `ZOHO_SMTP_HOST`.
  Email goes out through Zoho SMTP (port 465) using `cloudflare/smtp.js`, because nodemailer
  doesn't run on Workers. The email wording is shared in `netlify/functions/lib/welcome-content.mjs`.
- **Headers:** `cloudflare/_headers` (images cached for a year, `sold.json` no-cache).
- **Pretty URLs:** Cloudflare redirects `/terms.html` to `/terms` (308), like Netlify's pretty URLs.
- **Forms:** the HTML forms still carry `data-netlify` attributes. Netlify Forms were already turned
  off on the Netlify site, so they weren't collecting submissions there either.
