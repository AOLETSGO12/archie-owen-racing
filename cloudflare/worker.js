// Cloudflare Pages advanced-mode worker for archieowenracing.com.
// Keeps the two Netlify Function URLs working unchanged (the Stripe webhook is registered
// in Stripe at /.netlify/functions/stripe-webhook), with Workers KV in place of Netlify Blobs.
// Everything else is served from the static files (env.ASSETS). See _routes.json.
import { describeSession, buildEmails } from "../netlify/functions/lib/welcome-content.mjs";
import { buildMessage, smtpSession } from "./smtp.js";

const CHAMPIONSHIPS = ["british", "saudi", "ft4", "cez"];
const SLOTS = ["carnose", "carchassis", "carlowerpod", "sidepod", "helmetleft", "helmetright"];

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

async function validSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = {}; const v1s = [];
  for (const p of header.split(",")) { const [k, v] = p.split("="); if (k === "v1") v1s.push(v); else parts[k] = v; }
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) >= 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${payload}`)));
  // constant-time compare against each v1 signature
  return v1s.some(given => {
    if (!given || given.length !== want.length) return false;
    let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
    return diff === 0;
  });
}

export function slotsFromReference(ref) {
  const [champ, , slotPart] = String(ref ?? "").split("_");
  const champs = champ === "full" ? CHAMPIONSHIPS : CHAMPIONSHIPS.filter(c => c === champ);
  const slots = String(slotPart ?? "").split("-").filter(s => SLOTS.includes(s));
  return champs.flatMap(c => slots.map(s => `${c}:${s}`));
}

async function sendEmails(session, env) {
  const user = env.ZOHO_SMTP_USER, pass = env.ZOHO_SMTP_PASS;
  if (!(user && pass)) return "skipped: no SMTP settings";
  const info = describeSession(session);
  if (!info.email) return "skipped: no customer email";
  const mail = buildEmails(info);
  const from = `"Archie Owen Racing" <${user}>`;
  await smtpSession({ host: env.ZOHO_SMTP_HOST || "smtppro.zoho.uk", port: 465, user, pass }, async send => {
    await send({ fromAddr: user, rcpt: info.email, message: buildMessage({ from, to: info.email, replyTo: from, ...mail.welcome }) });
    await send({ fromAddr: user, rcpt: user, message: buildMessage({ from, to: user, ...mail.notice }) });
  });
  return "sent";
}

const getJSON = async (env, key) => (await env.SPONSORSHIP.get(key, { type: "json" })) ?? [];

async function availability(env) {
  return Response.json({ sold: await getJSON(env, "sold") }, { headers: { "Cache-Control": "no-store" } });
}

async function stripeWebhook(req, env) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const payload = await req.text();
  if (!(await validSignature(payload, req.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) {
    return new Response("Bad signature", { status: 400 });
  }
  const event = JSON.parse(payload);
  if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
    const session = event.data.object;
    const newly = slotsFromReference(session.client_reference_id);
    if (newly.length) {
      const sold = await getJSON(env, "sold");
      await env.SPONSORSHIP.put("sold", JSON.stringify([...new Set([...sold, ...newly])]));
    }
    // Stripe can deliver the same event more than once: only email each checkout once.
    const emailed = await getJSON(env, "emailed");
    if (!emailed.includes(session.id)) {
      try {
        const result = await sendEmails(session, env);
        if (result === "sent") await env.SPONSORSHIP.put("emailed", JSON.stringify([...emailed, session.id].slice(-500)));
        console.log("welcome email:", result);
      } catch (err) {
        // Don't fail the webhook (the spot is already marked sold); log so it shows in Cloudflare logs.
        console.error("welcome email failed:", err.message);
      }
    }
  }
  return new Response("ok");
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    const path = pathname.replace(/\/+$/, "");
    if (path === "/.netlify/functions/availability") return availability(env);
    if (path === "/.netlify/functions/stripe-webhook") return stripeWebhook(req, env);
    return env.ASSETS.fetch(req);
  },
};
