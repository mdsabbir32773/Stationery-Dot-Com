const META_WEBHOOK_PATH = "/webhooks/meta";
const GRAPH_VERSION = "v27.0";
const SUPABASE_URL = "https://efrqreeyuopdvmghfedx.supabase.co";
const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyMetaSignature(rawBody, signature, appSecret) {
  if (!signature?.startsWith("sha256=") || !appSecret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = "sha256=" + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(signature, expected);
}
async function db(env, path, options = {}) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error("Supabase " + response.status + ": " + text.slice(0, 400));
  return text ? JSON.parse(text) : null;
}
async function graph(env, path, body) {
  const response = await fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + path + "?access_token=" + encodeURIComponent(env.META_PAGE_ACCESS_TOKEN), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error("Meta API: " + JSON.stringify(data.error || data).slice(0, 500));
  return data;
}
async function makeReply(env, userText, settings, channel) {
  const prompt = [
    "You are the customer support assistant for Stationery Dot Com, a Bangladesh-based Digital, Travel & Meta Solution Hub.",
    "Reply naturally and briefly in Bangla when the customer uses Bangla or Banglish; otherwise reply in the customer's language.",
    "Be polite, helpful, concise, and human-sounding. Do not mention being an AI.",
    "Business rules: " + settings.business_rules,
    "Brand voice: " + settings.brand_voice,
    "Never invent prices, stock, availability, processing time, guarantees, order/payment status, or government outcomes.",
    "If asked for an exact price or status not explicitly provided in the message/context, ask them to share the service/package name or order code and say a team member will verify it.",
    "For complaints, refunds, legal/medical matters, account access, or sensitive personal information, politely ask them to contact a human at 01827-680520.",
    "Channel: " + channel,
    "Customer message: " + userText,
    "Write only the reply message."
  ].join("\n");
  const result = await env.AI.run(AI_MODEL, { prompt, max_tokens: 180, temperature: 0.25 });
  const reply = (result?.response || "").trim();
  if (!reply) throw new Error("AI returned an empty reply");
  return reply.slice(0, 1800);
}
async function getSettings(env) {
  const rows = await db(env, "sdc_fb_automation_settings?select=*&id=eq.true&limit=1");
  return rows?.[0] || null;
}
async function logEvent(env, eventType, eventId, inputText, status, errorMessage = null, aiReply = null) {
  if (!eventId) return;
  const existing = await db(env, "sdc_fb_automation_logs?select=id&external_event_id=eq." + encodeURIComponent(eventId) + "&limit=1");
  if (existing?.length) return false;
  await db(env, "sdc_fb_automation_logs", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ event_type: eventType, external_event_id: eventId, input_text: inputText, status, error_message: errorMessage, ai_reply: aiReply })
  });
  return true;
}
async function processIncoming(env, channel, senderId, text, eventId, pageId, commentId = null) {
  if (!senderId || !text || senderId === pageId || !eventId) return;
  const settings = await getSettings(env);
  if (!settings) return;
  const enabled = channel === "messenger" ? settings.auto_messenger_reply_enabled : settings.auto_comment_reply_enabled;
  if (!enabled) {
    await logEvent(env, channel, eventId, text, "skipped");
    return;
  }
  const threadId = channel === "messenger" ? senderId : (commentId || eventId);
  const conversations = await db(env, "sdc_fb_conversations?select=*&channel=eq." + channel + "&sender_id=eq." + encodeURIComponent(senderId) + "&limit=1");
  let conversation = conversations?.[0];
  if (conversation?.human_takeover) {
    await logEvent(env, channel, eventId, text, "skipped");
    return;
  }
  if (!conversation) {
    const created = await db(env, "sdc_fb_conversations", {
      method: "POST", headers: { prefer: "return=representation" },
      body: JSON.stringify({ channel, sender_id: senderId, thread_id: threadId, post_id: channel === "comment" ? eventId : null, last_message: text })
    });
    conversation = created?.[0];
  } else {
    await db(env, "sdc_fb_conversations?id=eq." + conversation.id, {
      method: "PATCH", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ last_message: text, last_message_at: new Date().toISOString() })
    });
  }
  const inserted = await logEvent(env, channel, eventId, text, "received");
  if (!inserted) return;
  try {
    const reply = await makeReply(env, text, settings, channel);
    if (channel === "messenger") {
      await graph(env, pageId + "/messages", { recipient: { id: senderId }, messaging_type: "RESPONSE", message: { text: reply } });
    } else {
      await graph(env, commentId + "/comments", { message: reply });
    }
    await db(env, "sdc_fb_automation_logs?external_event_id=eq." + encodeURIComponent(eventId), {
      method: "PATCH", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ status: "replied", ai_reply: reply, conversation_id: conversation?.id || null })
    });
  } catch (error) {
    await db(env, "sdc_fb_automation_logs?external_event_id=eq." + encodeURIComponent(eventId), {
      method: "PATCH", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", error_message: String(error).slice(0, 1000), conversation_id: conversation?.id || null })
    });
    console.error("Automation handler failed", channel, String(error));
  }
}
async function processWebhook(env, payload) {
  for (const entry of payload.entry || []) {
    const pageId = entry.id;
    for (const event of entry.messaging || []) {
      if (event.message?.is_echo || event.message?.is_deleted || event.read || event.delivery) continue;
      const text = event.message?.text;
      const senderId = event.sender?.id;
      const eventId = event.message?.mid;
      if (text && senderId && eventId) await processIncoming(env, "messenger", senderId, text, eventId, pageId);
    }
    for (const change of entry.changes || []) {
      if (change.field !== "feed") continue;
      const value = change.value || {};
      if (value.item !== "comment" || value.verb !== "add" || value.is_hidden) continue;
      const senderId = value.from?.id;
      const commentId = value.comment_id;
      const text = value.message;
      if (senderId && commentId && text) await processIncoming(env, "comment", senderId, text, commentId, pageId, commentId);
    }
  }
}


async function setupMetaWebhooks(env) {
  const appId = "3024451134569102";
  const callback = "https://stationerydotcom.stdc.workers.dev/webhooks/meta";
  const appToken = appId + "|" + env.META_APP_SECRET;
  const appForm = new URLSearchParams({
    object: "page",
    callback_url: callback,
    fields: "feed,messages",
    verify_token: env.META_VERIFY_TOKEN,
    access_token: appToken
  });
  const appResponse = await fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + appId + "/subscriptions", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: appForm
  });
  const appData = await appResponse.json();
  if (!appResponse.ok || appData.error) return json({ step: "app_webhook_subscription", success: false, error: appData.error || appData }, 502);
  // The target Page ID is fixed for Stationery Dot Com. Do not infer it from debug_token metadata.
  const pageId = "917752031418611";
  // Resolve a Page token even when the configured token is a User token.
  const identityResponse = await fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + pageId + "?fields=id,name,access_token&access_token=" + encodeURIComponent(env.META_PAGE_ACCESS_TOKEN));
  const identityData = await identityResponse.json();
  if (!identityResponse.ok || identityData.error || identityData.id !== pageId || !identityData.access_token) return json({ step: "page_identity", success: false, error: identityData.error || { message: "Could not obtain a Page access token for the configured Page", page_id: pageId } }, 502);
  const pageToken = identityData.access_token;
  const messageUrl = "https://graph.facebook.com/" + GRAPH_VERSION + "/" + pageId + "/subscribed_apps?subscribed_fields=messages&access_token=" + encodeURIComponent(pageToken);
  const messageResponse = await fetch(messageUrl, { method: "POST" });
  const messageData = await messageResponse.json();
  if (!messageResponse.ok || messageData.error) return json({ step: "page_messenger_subscription", success: false, page_id: pageId, app_subscription: appData, error: messageData.error || messageData }, 502);
  await db(env, "sdc_fb_automation_settings?id=eq.true", {
    method: "PATCH", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ page_id: pageId, updated_at: new Date().toISOString() })
  });
  const feedUrl = "https://graph.facebook.com/" + GRAPH_VERSION + "/" + pageId + "/subscribed_apps?subscribed_fields=feed&access_token=" + encodeURIComponent(pageToken);
  const feedResponse = await fetch(feedUrl, { method: "POST" });
  const feedData = await feedResponse.json();
  if (!feedResponse.ok || feedData.error) return json({ step: "page_comment_subscription", success: false, page_id: pageId, app_subscription: appData, messenger_subscription: messageData, error: feedData.error || feedData }, 502);
  await db(env, "sdc_fb_automation_settings?id=eq.true", {
    method: "PATCH", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ page_id: pageId, updated_at: new Date().toISOString() })
  });
  return json({ success: true, app_subscription: appData, messenger_subscription: messageData, comment_subscription: feedData, page_id: pageId, fields: ["feed", "messages"] });
}
export default {
  async scheduled(controller, env) {
    if (controller.cron !== "* * * * *") return;
    const eventId = "meta_setup_" + Math.floor(controller.scheduledTime / 60000);
    try {
      const response = await setupMetaWebhooks(env);
      const result = await response.json();
      await logEvent(env, "meta_setup", eventId, "Meta webhook registration attempt", result.success ? "replied" : "failed", result.success ? null : JSON.stringify(result.error || result).slice(0, 1000), JSON.stringify(result).slice(0, 1800));
      console.log("One-time Meta webhook setup:", JSON.stringify(result));
    } catch (error) {
      await logEvent(env, "meta_setup", eventId, "Meta webhook registration attempt", "failed", String(error).slice(0, 1000));
      console.error("Meta webhook setup exception:", String(error));
    }
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/_internal/meta-webhook-setup" && request.method === "GET") {
      if (url.searchParams.get("key") !== env.META_VERIFY_TOKEN) return new Response("Forbidden", { status: 403 });
      return setupMetaWebhooks(env);
    }
    if (url.pathname === META_WEBHOOK_PATH) {
      if (request.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token && token === env.META_VERIFY_TOKEN && challenge) return new Response(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
        return new Response("Forbidden", { status: 403 });
      }
      if (request.method === "POST") {
        const rawBody = await request.text();
        if (!(await verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), env.META_APP_SECRET))) return json({ error: "Invalid webhook signature" }, 401);
        let payload;
        try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON payload" }, 400); }
        ctx.waitUntil(processWebhook(env, payload).catch(error => console.error("Meta webhook processing failed", String(error))));
        return json({ received: true });
      }
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, POST" } });
    }
    return env.ASSETS.fetch(request);
  }
};
