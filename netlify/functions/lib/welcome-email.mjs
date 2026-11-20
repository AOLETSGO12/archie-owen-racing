// Sends the automatic emails after a sponsor pays online (Netlify version, via nodemailer).
// The email wording lives in welcome-content.mjs, shared with the Cloudflare version.
import nodemailer from "nodemailer";
import { describeSession, buildEmails } from "./welcome-content.mjs";

export { describeSession, buildEmails };

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
