// Minimal SMTP client for Cloudflare Workers (implicit TLS on port 465, AUTH LOGIN).
// Workers can't run nodemailer, so this sends the same two emails over a raw TLS socket.
import { connect } from "cloudflare:sockets";

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = str => { let bin = ""; for (const b of enc.encode(str)) bin += String.fromCharCode(b); return btoa(bin); };
const wrap76 = s => s.replace(/.{1,76}/g, "$&\r\n");
const header = v => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

export function buildMessage({ from, to, replyTo, subject, text, html, domain = "archieowenracing.com" }) {
  const id = crypto.randomUUID();
  const head = [
    `From: ${from}`, `To: ${to}`, ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${header(subject)}`, `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${id}@${domain}>`, "MIME-Version: 1.0",
  ];
  const part = (type, body) => [`Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", wrap76(b64(body))].join("\r\n");
  if (!html) return [...head, part("text/plain", text)].join("\r\n");
  const boundary = `b_${id}`;
  return [...head, `Content-Type: multipart/alternative; boundary="${boundary}"`, "",
    `--${boundary}`, part("text/plain", text), `--${boundary}`, part("text/html", html), `--${boundary}--`, ""].join("\r\n");
}

export async function smtpSession({ host, port = 465, user, pass }, work) {
  const socket = connect({ hostname: host, port }, { secureTransport: "on", allowHalfOpen: false });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  let buf = "";
  const read = async () => {
    for (;;) {
      const lines = buf.split("\r\n");
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3}( |$)/.test(lines[i])) {
          buf = lines.slice(i + 1).join("\r\n");
          return { code: Number(lines[i].slice(0, 3)), text: lines.slice(0, i + 1).join("\n") };
        }
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("SMTP connection closed");
      buf += dec.decode(value, { stream: true });
    }
  };
  const cmd = async (line, ok, label = line) => {
    if (line != null) await writer.write(enc.encode(line + "\r\n"));
    const res = await read();
    if (!ok.includes(res.code)) throw new Error(`SMTP ${label?.split(" ")[0] ?? "greeting"} failed: ${res.code}`);
    return res;
  };
  try {
    await cmd(null, [220], "greeting");
    await cmd("EHLO archieowenracing.com", [250]);
    await cmd("AUTH LOGIN", [334]);
    await cmd(b64(user), [334], "AUTH user");
    await cmd(b64(pass), [235], "AUTH pass");
    const send = async ({ fromAddr, rcpt, message }) => {
      await cmd(`MAIL FROM:<${fromAddr}>`, [250]);
      await cmd(`RCPT TO:<${rcpt}>`, [250, 251]);
      await cmd("DATA", [354]);
      const body = message.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
      await cmd(body + "\r\n.", [250], "DATA body");
    };
    const result = await work(send);
    await cmd("QUIT", [221]).catch(() => {});
    return result;
  } finally {
    try { await socket.close(); } catch {}
  }
}
