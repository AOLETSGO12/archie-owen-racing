// POST /.netlify/functions/stripe-webhook
// Stripe calls this after each successful payment. The checkout puts the championship and the
// branding slots it bought into client_reference_id, e.g. "british_partner_carnose_k3x9",
// and this marks those slots as sold so the website stops offering them. It also sends the
// sponsor's welcome email and a notice to Archie's inbox (see lib/welcome-email.mjs).
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { sendEmails } from "./lib/welcome-email.mjs";

const CHAMPIONSHIPS = ["british", "saudi", "ft4", "cez"];
const SLOTS = ["carnose", "carchassis", "carlowerpod", "sidepod", "helmetleft", "helmetright"];

function validSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const given = Buffer.from(parts.v1 ?? "", "hex");
  const want = Buffer.from(expected, "hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return fresh && given.length === want.length && crypto.timingSafeEqual(given, want);
}

export function slotsFromReference(ref) {
  const [champ, , slotPart] = String(ref ?? "").split("_");
  const champs = champ === "full" ? CHAMPIONSHIPS : CHAMPIONSHIPS.filter(c => c === champ);
  const slots = String(slotPart ?? "").split("-").filter(s => SLOTS.includes(s));
  return champs.flatMap(c => slots.map(s => `${c}:${s}`));
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const payload = await req.text();
  if (!validSignature(payload, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET)) {
    return new Response("Bad signature", { status: 400 });
  }
  const event = JSON.parse(payload);
  if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
    const session = event.data.object;
    const store = getStore("sponsorship");
    const newly = slotsFromReference(session.client_reference_id);
    if (newly.length) {
      const sold = (await store.get("sold", { type: "json" })) ?? [];
      await store.setJSON("sold", [...new Set([...sold, ...newly])]);
    }
    // Stripe can deliver the same event more than once: only email each checkout once.
    const emailed = (await store.get("emailed", { type: "json" })) ?? [];
    if (!emailed.includes(session.id)) {
      try {
        const result = await sendEmails(session);
        if (result === "sent") await store.setJSON("emailed", [...emailed, session.id].slice(-500));
        console.log("welcome email:", result);
      } catch (err) {
        // Don't fail the webhook (the spot is already marked sold); log so it shows in Netlify.
        console.error("welcome email failed:", err.message);
      }
    }
  }
  return new Response("ok");
};
