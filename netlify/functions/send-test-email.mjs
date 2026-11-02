// TEMPORARY: sends one sample welcome email to Archie's own iCloud address to test Zoho SMTP.
// Recipient is fixed, so it can't be used to email anyone else. Remove after testing.
import { sendEmails } from "./lib/welcome-email.mjs";

export default async () => {
  const session = {
    id: "cs_test_email_" + Date.now(),
    client_reference_id: "ft4_supporter__test",
    amount_total: 75000,
    currency: "gbp",
    customer_details: { email: "mrarchieowen@icloud.com", name: "Archie Owen", business_name: "TEST – sample email" },
  };
  try {
    return new Response("Result: " + (await sendEmails(session)));
  } catch (err) {
    return new Response("Failed: " + err.message, { status: 500 });
  }
};
