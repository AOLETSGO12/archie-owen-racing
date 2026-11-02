// Builds and sends the automatic emails after a sponsor pays online:
// a welcome email to the sponsor and a "new sponsor" notice to Archie's inbox.
import nodemailer from "nodemailer";

const CHAMP_NAMES = {
  british: "F4 British Championship 2027 (with Hitech)",
  saudi: "Aramco F4 Saudi Arabian Championship, rest of 2026",
  ft4: "FT4 Winter Series 2027",
  cez: "F4 CEZ Championship 2027",
  full: "Full 2027 programme (12 months)",
};
const PACKAGE_NAMES = { partner: "Partner", supporter: "Supporter" };
const SLOT_NAMES = {
  carnose: "Car: front of the nose",
  carchassis: "Car: behind the front wheel",
  carlowerpod: "Car: lower sidepod panel",
  helmetleft: "Helmet: left side",
  helmetright: "Helmet: right side",
};

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (pence, cur = "gbp") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: cur.toUpperCase() }).format((pence ?? 0) / 100);

export function describeSession(session) {
  const [champ, pkg, slotPart] = String(session.client_reference_id ?? "").split("_");
  const slots = String(slotPart ?? "").split("-").map(s => SLOT_NAMES[s]).filter(Boolean);
  slots.push("Race suit: chest");
  const d = session.customer_details ?? {};
  return {
    packageName: PACKAGE_NAMES[pkg] ?? "Sponsorship",
    championship: CHAMP_NAMES[champ] ?? "",
    positions: slots,
    amount: money(session.amount_total, session.currency),
    email: d.email,
    name: d.name || "",
    company: d.business_name || session.collected_information?.business_name || "",
    sessionId: session.id,
  };
}

export function buildEmails(info) {
  const first = (info.name || "").split(" ")[0] || "there";
  const title = `${info.packageName} – ${info.championship}`;
  const steps = [
    "<strong>Your sponsorship agreement:</strong> within 2 working days we&rsquo;ll email it to you to sign. It confirms your package, race and logo position.",
    '<strong>Send us your logo</strong> (if you haven&rsquo;t already) at <a href="https://archieowenracing.com/welcome.html">archieowenracing.com/welcome.html</a>. Vector files (SVG, EPS, AI or PDF) are best.',
    "<strong>Approval:</strong> within 7 days we&rsquo;ll send your logo to Hitech and the championship for approval.",
    "<strong>Your race:</strong> at least 14 days before the race you chose, we&rsquo;ll confirm guest arrangements.",
    "<strong>Through the season:</strong> we&rsquo;ll share partner content and race photography for you to use.",
  ];
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:600px">
<p>Hi ${esc(first)},</p>
<p>Thank you for sponsoring Archie. Your payment of <strong>${esc(info.amount)}</strong> for <strong>${esc(title)}</strong> has been received, and your Stripe receipt is in a separate email.</p>
<p><strong>Your logo positions</strong></p>
<ul>${info.positions.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
<p><strong>What happens next</strong></p>
<ol>${steps.map(s => `<li style="margin-bottom:6px">${s}</li>`).join("")}</ol>
<p>Full terms: <a href="https://archieowenracing.com/terms.html">archieowenracing.com/terms.html</a></p>
<p>If you have any further questions, email <a href="mailto:archie@archieowenracing.com">archie@archieowenracing.com</a>.</p>
<p>Thanks again for backing Archie,<br>Archie Owen Racing</p>
<table cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse"><tr>
<td style="padding-right:14px;border-right:3px solid #fd0003"><img src="https://archieowenracing.com/images/email-logo.png" width="84" height="48" alt="Archie Owen #40" style="display:block"></td>
<td style="padding-left:14px;font-size:12px;color:#555"><strong style="color:#111;font-size:14px">ARCHIE OWEN</strong><br>Hitech British F4 Driver · 2027<br><a href="https://archieowenracing.com" style="color:#111">archieowenracing.com</a> · <a href="https://www.instagram.com/archieowenracing/" style="color:#111">@archieowenracing</a></td>
</tr></table></div>`;
  const text = [
    `Hi ${first},`, "",
    `Thank you for sponsoring Archie. Your payment of ${info.amount} for ${title} has been received, and your Stripe receipt is in a separate email.`, "",
    "Your logo positions:", ...info.positions.map(p => `- ${p}`), "",
    "What happens next:",
    "1. Your sponsorship agreement: within 2 working days we'll email it to you to sign.",
    "2. Send us your logo (if you haven't already): https://archieowenracing.com/welcome.html",
    "3. Approval: within 7 days we'll send your logo to Hitech and the championship.",
    "4. Your race: at least 14 days before, we'll confirm guest arrangements.",
    "5. Through the season: partner content and race photography for you to use.", "",
    "Full terms: https://archieowenracing.com/terms.html",
    "If you have any further questions, email archie@archieowenracing.com.", "",
    "Thanks again for backing Archie,", "Archie Owen Racing",
  ].join("\n");
  const notice = [
    `New online sponsor: ${info.company || info.name || info.email}`, "",
    `Package: ${title}`, `Paid: ${info.amount}`, `Name: ${info.name}`, `Company: ${info.company}`, `Email: ${info.email}`,
    `Logo positions: ${info.positions.join("; ")}`, `Stripe checkout: ${info.sessionId}`, "",
    "Their chosen race is in the Netlify Forms 'sponsor-checkout' submission.",
    "Next: send the sponsorship agreement within 2 working days.",
  ].join("\n");
  return {
    welcome: { subject: `Welcome to Archie Owen Racing – your ${info.packageName} sponsorship`, html, text },
    notice: { subject: `New sponsor: ${info.packageName} – ${info.company || info.name || info.email} (${info.amount})`, text: notice },
  };
}

export async function sendEmails(session, transport) {
  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASS;
  if (!transport && !(user && pass)) return "skipped: no SMTP settings";
  const info = describeSession(session);
  if (!info.email) return "skipped: no customer email";
  const mail = buildEmails(info);
  const t = transport ?? nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || "smtppro.zoho.uk", port: 465, secure: true, auth: { user, pass },
  });
  const from = `"Archie Owen Racing" <${user || "archie@archieowenracing.com"}>`;
  await t.sendMail({ from, to: info.email, replyTo: from, subject: mail.welcome.subject, text: mail.welcome.text, html: mail.welcome.html });
  await t.sendMail({ from, to: user || "archie@archieowenracing.com", subject: mail.notice.subject, text: mail.notice.text });
  return "sent";
}
