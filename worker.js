const META_WEBHOOK_PATH = "/webhooks/meta";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyMetaSignature(rawBody, signature, appSecret) {
  if (!signature || !signature.startsWith("sha256=") || !appSecret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = "sha256=" + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(signature, expected);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === META_WEBHOOK_PATH) {
      if (request.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token && token === env.META_VERIFY_TOKEN && challenge) {
          return new Response(challenge, {
            status: 200,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
        return new Response("Forbidden", { status: 403 });
      }

      if (request.method === "POST") {
        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256");
        const valid = await verifyMetaSignature(rawBody, signature, env.META_APP_SECRET);
        if (!valid) return json({ error: "Invalid webhook signature" }, 401);

        let payload;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return json({ error: "Invalid JSON payload" }, 400);
        }

        // Securely verified events are acknowledged. Automation handlers are added
        // in the next deployment after the server-side database and AI credentials
        // are configured.
        const entries = Array.isArray(payload.entry) ? payload.entry.length : 0;
        console.log("Verified Meta webhook event", {
          object: payload.object || null,
          entries,
          receivedAt: new Date().toISOString(),
        });
        return json({ received: true });
      }

      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "GET, POST" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
