# Online sponsorship payments: setup (for James)

**Status (2 Nov 2026):** site now deploys from AOLETSGO12/archie-owen-racing (`main` = live, `preview` = result updates).

**Earlier status (30 Oct 2026):** the Stripe account (Owen Motorsport Ltd) is connected and all 10
payment links below were created and added to the website. Remaining: set the Terms of service
URL in Stripe, Netlify Forms, the webhook (step 6) and the welcome email (step 5).


The website already has the checkout built. It needs **10 Stripe Payment Links** pasted in, and one
Zapier automation for the welcome email. About 30 minutes in total.

## 1. Open a Stripe account (adult account holder)
1. Go to https://dashboard.stripe.com/register and sign up in your own name (individual / sole trader).
2. Add your bank account for payouts and complete identity verification.
3. Settings → Business → Public details: business name "Archie Owen Racing", support email
   archie@archieowenracing.com, website https://archieowenracing.com.

## 2. Create the 10 Payment Links
Dashboard → Product catalogue → Add product (one per line below), then Payment Links → New.

| Key in website            | Product name                           | Price   | Limit payments to |
|---------------------------|----------------------------------------|---------|-------------------|
| `partner|british`         | Partner – British F4 2027              | £8,000  | 3                 |
| `partner|saudi`           | Partner – Saudi F4, rest of 2026       | £5,000  | 3                 |
| `partner|ft4`             | Partner – FT4 Winter Series 2027       | £3,500  | 3                 |
| `partner|cez`            | Partner – F4 CEZ Championship 2027     | £5,000  | 3                 |
| `partner|full`            | Partner – Full 2027 programme          | £13,000 | 3                 |
| `supporter|british`       | Supporter – British F4 2027            | £2,000  | 3                 |
| `supporter|saudi`         | Supporter – Saudi F4, rest of 2026     | £1,000  | 3                 |
| `supporter|ft4`           | Supporter – FT4 Winter Series 2027     | £750    | 3                 |
| `supporter|cez`          | Supporter – F4 CEZ Championship 2027   | £1,000  | 3                 |
| `supporter|full`          | Supporter – Full 2027 programme        | £3,000  | 3                 |

There are three Partner car positions (front of the nose, behind the front wheel, black lower sidepod panel), each for a different brand, so each Partner link sells up to three times. The website itself tracks
every individual spot (see step 6); these limits are a backstop.

On **every** Payment Link:
- Options → **Limit the number of payments** → the number above.
- Options → **Require customers to accept your terms of service** → terms URL
  `https://archieowenracing.com/terms.html` (set under Settings → Public details).
- **After payment** → Don't show confirmation page → **Redirect customers to your website** →
  `https://archieowenracing.com/welcome.html`
- Payment methods: cards, Apple Pay, Google Pay (on by default).
- Settings → Emails → turn on **Successful payments** receipts.

## 3. Paste the links into the website
Send the 10 links to Claude, or paste them yourself: in `index.html` search for
`const PAYMENT_LINKS` and put each link between the quotes next to its key. Any option left
empty shows "Online payment coming soon" instead of a pay button.

## 4. Turn on Netlify Forms
Netlify → your site → **Forms** → **Enable form detection**, then upload the site again.
Three forms will appear:
- `sponsor-checkout`: every buyer's package, championship, race and logo position
  (saved just before they're sent to Stripe).
- `sponsor-logo`: logo uploads from the welcome page.
- `partnership-enquiry`: general enquiries.

Forms → Form notifications → **Email notification** → archie@archieowenracing.com, for all three.

## 5. Automatic welcome email (built in)
The Stripe webhook (`netlify/functions/stripe-webhook.mjs`) sends the sponsor's welcome email
and a "New sponsor" notice to archie@archieowenracing.com straight after each payment, through
Zoho Mail. It needs two Netlify environment variables:
- `ZOHO_SMTP_USER` = `archie@archieowenracing.com`
- `ZOHO_SMTP_PASS` = a Zoho app password (accounts.zoho.uk → Security → App Passwords),
  marked "Contains secret values".
Without them the payment still works and the spot is still marked sold; only the email is skipped.
If an email fails, it shows in Netlify → Logs → Functions → stripe-webhook.

## 6. Live "sold" spots (automatic)
The checkout hides any logo position that has already been bought, per championship.
The spots are: car front of nose / behind front wheel / lower sidepod panel, helmet left side / right side. Suit logos all go on the chest and aren't limited per spot.

This needs the site deployed **from GitHub**, not by drag and drop, because it uses two small
Netlify Functions (`netlify/functions/`):
1. Netlify → your site → Site configuration → Build & deploy → **Link repository** → GitHub →
   `AOLETSGO12/sitescout`, branch `claude/archie-owen-sponsor-site-rcysn8` (or `main` once merged).
   - Base directory: `archie-owen-site`
   - Build command: leave empty
   - Publish directory: `archie-owen-site` (Netlify shows it as `.` inside the base)
2. Stripe → Developers → **Webhooks** → Add endpoint:
   - URL: `https://archieowenracing.com/.netlify/functions/stripe-webhook`
   - Event: `checkout.session.completed`
   - Copy the **Signing secret** (starts `whsec_`).
3. Netlify → Site configuration → **Environment variables** → add
   `STRIPE_WEBHOOK_SECRET` = the signing secret. Redeploy.
4. Test: make a test-mode purchase; the chosen spot should show "(taken)" on the site
   straight away. To free a spot after a refund, ask Claude, or remove it from the list.

**Sidepod (Principal):** if a Principal Partner (agreed by proposal) chooses sidepods, add `"<championship>:sidepod"` to `sold.json`; the Partner positions are unaffected.

**Manual fallback:** `sold.json` in the site folder is also read by the checkout. If you keep
using drag-and-drop uploads, add sold spots there by hand, e.g.
`"sold": ["british:carnose", "british:helmetleft"]`, and upload again.

## 7. Before going live
- Ask Dominic Stott (Hitech) to read `terms.html`, especially logo approval and banned categories.
- Do one live test purchase on the cheapest option and refund it from the Stripe dashboard.
