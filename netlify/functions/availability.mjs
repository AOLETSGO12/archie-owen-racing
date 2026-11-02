// GET /.netlify/functions/availability
// Returns the branding slots that have already been sold, e.g. { "sold": ["british:carnose"] }
import { getStore } from "@netlify/blobs";

export default async () => {
  const store = getStore("sponsorship");
  const sold = (await store.get("sold", { type: "json" })) ?? [];
  return Response.json({ sold }, { headers: { "Cache-Control": "no-store" } });
};
