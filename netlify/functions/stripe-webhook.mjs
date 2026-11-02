// POST /.netlify/functions/stripe-webhook
// Stripe calls this after each successful payment. The checkout puts the championship and the
// branding slots it bought into client_reference_id, e.g. "british_partner_carnose-suitchest_k3x9",
// and this marks those slots as sold so the website stops offering them.
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

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
    const newly = slotsFromReference(event.data.object.client_reference_id);
    if (newly.length) {
      const store = getStore("sponsorship");
      const sold = (await store.get("sold", { type: "json" })) ?? [];
      await store.setJSON("sold", [...new Set([...sold, ...newly])]);
    }
  }
  return new Response("ok");
};
