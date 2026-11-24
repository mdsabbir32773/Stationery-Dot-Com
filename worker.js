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
function xmlEscape(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
async function dynamicSitemap(env) {
  const now = new Date().toISOString();
  const [services, posts] = await Promise.all([
    db(env, "services?select=slug&is_active=eq.true&order=slug.asc"),
    db(env, "blog_posts?select=slug,published_at&status=eq.published&published_at=not.is.null&published_at=lte." + encodeURIComponent(now) + "&order=published_at.desc")
  ]);
  const origin = "https://stationerydotcom.me";
  const urls = new Map();
  const add = (path, lastmod = null) => {
    const loc = origin + path;
    urls.set(loc, lastmod ? String(lastmod).slice(0, 10) : null);
  };
  ["/", "/about", "/services", "/digital-subscriptions", "/document-services", "/meta-services", "/creative-services", "/smm", "/contact", "/help", "/blog", "/refund-policy", "/delivery-policy", "/privacy-policy", "/terms-of-service"].forEach(path => add(path));
  for (const service of services || []) {
    if (service?.slug && /^[a-z0-9-]+$/.test(service.slug)) add("/services/" + service.slug);
  }
  for (const post of posts || []) {
    if (post?.slug && /^[a-z0-9-]+$/.test(post.slug)) add("/blog/" + post.slug, post.published_at);
  }
  const entries = Array.from(urls, ([loc, lastmod]) =>
    "<url><loc>" + xmlEscape(loc) + "</loc>" + (lastmod ? "<lastmod>" + xmlEscape(lastmod) + "</lastmod>" : "") + "</url>"
  ).join("");
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries + "</urlset>";
  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=1800, s-maxage=1800"
    }
  });
}
async function getPageAccessToken(env, pageId) {
  const configuredToken = env.META_PAGE_ACCESS_TOKEN;
  if (!configuredToken) throw new Error("META_PAGE_ACCESS_TOKEN is not configured");

  // The configured value may be a User token. Resolve the actual Page token
  // for the configured Page instead of passing a User token to /subscribed_apps.
  const accountsUrl = new URL("https://graph.facebook.com/" + GRAPH_VERSION + "/me/accounts");
  accountsUrl.searchParams.set("fields", "id,name,access_token");
  accountsUrl.searchParams.set("limit", "200");
  accountsUrl.searchParams.set("access_token", configuredToken);
  let accountsData = null;
  let nextAccountsUrl = accountsUrl;
  // Follow pagination so Pages beyond the first result batch are not missed.
  for (let pageNumber = 0; pageNumber < 10 && nextAccountsUrl; pageNumber++) {
    const accountsResponse = await fetch(nextAccountsUrl);
    accountsData = await accountsResponse.json();
    if (!accountsResponse.ok || accountsData.error) break;
    const page = (accountsData.data || []).find(item => String(item.id) === String(pageId));
    if (page?.access_token) return page.access_token;
    const nextUrl = accountsData.paging?.next;
    nextAccountsUrl = nextUrl && new URL(nextUrl).hostname === "graph.facebook.com" ? nextUrl : null;
  }

  // Business-owned/client Pages may not appear in /me/accounts. Try the
  // Business asset edges as a second supported route to a Page token.
  const businessId = "701827621820491";
  let businessErrors = [];
  for (const edge of ["owned_pages", "client_pages"]) {
    const businessUrl = new URL("https://graph.facebook.com/" + GRAPH_VERSION + "/" + businessId + "/" + edge);
    businessUrl.searchParams.set("fields", "id,name,access_token");
    businessUrl.searchParams.set("limit", "200");
    businessUrl.searchParams.set("access_token", configuredToken);
    const businessResponse = await fetch(businessUrl);
    const businessData = await businessResponse.json();
    if (businessResponse.ok && !businessData.error) {
      const page = (businessData.data || []).find(item => String(item.id) === String(pageId));
      if (page?.access_token) return page.access_token;
    } else if (businessData.error?.message) {
      businessErrors.push(edge + ": " + businessData.error.message);
    }
  }

  // Also support a configured Page token directly. Never return token contents
  // in errors or logs.
  const identityUrl = new URL("https://graph.facebook.com/" + GRAPH_VERSION + "/" + pageId);
  identityUrl.searchParams.set("fields", "id,name");
  identityUrl.searchParams.set("access_token", configuredToken);
  const identityResponse = await fetch(identityUrl);
  const identityData = await identityResponse.json();
  if (identityResponse.ok && !identityData.error && String(identityData.id) === String(pageId)) {
    return configuredToken;
  }

  const reason = accountsData.error?.message || businessErrors.join(" | ") || identityData.error?.message || "The configured Meta token cannot access this Page";
  throw new Error("Cannot obtain a Page access token for Page " + pageId + ". " + reason + ". The token must have access to this Page and pages_manage_metadata.");
}
async function graph(env, path, body) {
  const pageId = String(path).split("/")[0];
  const pageToken = await getPageAccessToken(env, pageId);
  const response = await fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + path + "?access_token=" + encodeURIComponent(pageToken), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error("Meta API: " + JSON.stringify(data.error || data).slice(0, 500));
  return data;
}
async function makeReply(env, userText, settings, channel) {
  const normalizedText = String(userText || "").toLowerCase().replace(/[\s\p{P}]+/gu, " ").trim();
  const asksServices = /(?:কি কি সার্ভিস|কী কী সার্ভিস|কি সার্ভিস|কী সার্ভিস|সেবাসমূহ|কি কি সেবা|কী কী সেবা|what services|services do you offer|list your services|available services)/u.test(normalizedText);
  if (asksServices) {
    const isBangla = /[\u0980-\u09ff]/u.test(userText) || /bangla|banglish/u.test(normalizedText);
    return isBangla
      ? "আমাদের প্রধান সেবাগুলো হলো ডিজিটাল সাবস্ক্রিপশন, ফেসবুক ও ইনস্টাগ্রাম পেজ সেটআপ ও পরিচালনা, বিজ্ঞাপন প্রচার, ভিসা সহায়তা, বিমান টিকিট ও হোটেল বুকিং, জন্মনিবন্ধন, জাতীয় পরিচয়পত্র ও পাসপোর্ট সংক্রান্ত সহায়তা, এবং লোগো, ব্যানার ও ভিডিও সম্পাদনা। কোন সেবাটি নিতে চান জানালে বিস্তারিত জানাতে পারব।"
      : "We offer digital subscriptions, Facebook and Instagram page setup and management, advertising support, visa assistance, air tickets, hotel bookings, document application support, graphic design, video editing, and website creation. Which service would you like to know more about?";
  }
  const prompt = [
    "You are the official customer-support representative of Stationery Dot Com in Bangladesh.",
    "BUSINESS: Stationery Dot Com is a Digital, Travel & Meta Solution Hub.",
    "SERVICES: (1) Digital subscriptions and software plans such as Canva Pro, Google One, ChatGPT, CapCut and other digital tools. (2) Meta/Facebook/Instagram services: page setup and optimization, business setup, verification guidance, ads/boosting and page management. (3) Travel services: tourist visa assistance, air tickets, hotel booking, Umrah and visit-visa support. (4) Document assistance: birth certificate, NID, passport, TIN, trade licence and online applications. (5) Creative services: logo, banner, social media design, video editing and website creation.",
    "LANGUAGE: If customer writes Bangla or Banglish, answer in natural, simple Bangla. Otherwise use the customer's language.",
    "STYLE: Friendly, professional, human, clear. Usually 2-3 short sentences. Answer the actual question directly. Never start with grand promotional slogans or say 'all your problems'. Do not repeat the business introduction in every reply.",
    "ROUTING: If customer asks what services are available, briefly list the relevant service categories and ask which one they need. If they mention a specific service, respond only about that service.",
    "ACCURACY: Never invent prices, stock, availability, processing times, guarantees, order/payment status, or government outcomes. If exact details are not present, ask which package/service they mean and say the team can confirm.",
    "HUMAN SUPPORT: For complaints, refunds, account access, sensitive matters, or requests needing manual checking, direct them to 01827-680520.",
    "Additional business rules: " + (settings.business_rules || ""),
    "Brand voice: " + (settings.brand_voice || ""),
    "Channel: " + channel,
    "Customer message: " + userText,
    "Return one complete, ready-to-send reply only. Do not end mid-sentence."
  ].join("\n");
  const result = await env.AI.run(AI_MODEL, { prompt, max_tokens: 320, temperature: 0.2 });
  const reply = (result?.response || "").trim();
  if (!reply) throw new Error("AI returned an empty reply");
  const looksLikePromptLeak = /do not add extra information|do not use abbreviations|you are the official customer-support|customer message:/i.test(reply);
  if (looksLikePromptLeak || reply.length > 900) {
    return "আপনার প্রশ্নটি বুঝেছি। সঠিক তথ্য দিতে আমাদের সঙ্গে 01827-680520 নম্বরে যোগাযোগ করুন।";
  }
  return reply.slice(0, 900);
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
  // The target Page ID is fixed for Stationery Dot Com.
  const pageId = "917752031418611";
  // Resolve the actual Page token. The configured secret may be a User token;
  // getPageAccessToken exchanges it through /me/accounts when the Page is assigned.
  let pageToken;
  try {
    pageToken = await getPageAccessToken(env, pageId);
  } catch (error) {
    return json({ step: "page_identity", success: false, page_id: pageId, error: { message: String(error).slice(0, 700) }, app_subscription: appData }, 502);
  }
  // Subscribe both Page webhook fields in one request. Separate calls can replace
  // the previous subscribed_fields set instead of accumulating it.
  const pageSubscriptionUrl = "https://graph.facebook.com/" + GRAPH_VERSION + "/" + pageId + "/subscribed_apps?subscribed_fields=messages,feed&access_token=" + encodeURIComponent(pageToken);
  const pageSubscriptionResponse = await fetch(pageSubscriptionUrl, { method: "POST" });
  const pageSubscriptionData = await pageSubscriptionResponse.json();
  if (!pageSubscriptionResponse.ok || pageSubscriptionData.error) return json({ step: "page_subscription", success: false, page_id: pageId, app_subscription: appData, error: pageSubscriptionData.error || pageSubscriptionData }, 502);
  await db(env, "sdc_fb_automation_settings?id=eq.true", {
    method: "PATCH", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ page_id: pageId, updated_at: new Date().toISOString() })
  });
  return json({ success: true, app_subscription: appData, page_subscription: pageSubscriptionData, page_id: pageId, fields: ["messages", "feed"] });
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

    // Keep the workers.dev hostname as a redirect-only alias for the public site.
    // The Meta webhook remains on workers.dev because its callback is registered there.
    if (url.hostname === "www.stationerydotcom.me" || (url.hostname === "stationerydotcom.stdc.workers.dev" && url.pathname !== META_WEBHOOK_PATH && url.pathname !== "/_internal/meta-webhook-setup")) {
      url.hostname = "stationerydotcom.me";
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname === "/sitemap.xml" && request.method === "GET") {
      try {
        return await dynamicSitemap(env);
      } catch (error) {
        console.error("Dynamic sitemap generation failed:", String(error));
        return env.ASSETS.fetch(request);
      }
    }
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
    const assetResponse = await env.ASSETS.fetch(request);
    const acceptsHtml = request.method === "GET" && (request.headers.get("accept") || "").includes("text/html");
    const isPageRoute = !url.pathname.split("/").pop()?.includes(".");
    if (acceptsHtml && isPageRoute && assetResponse.headers.get("content-type")?.includes("text/html")) {
      let html = await assetResponse.text();
      // Canonical SEO host and indexability rules are covered by the public browser smoke test.
      // Public category landing pages are also covered by the SEO smoke suite.
      // Meta and creative service landing pages share the same canonical and indexability rules.
      // Service detail pages link back to their matching category landing pages.
      const route = url.pathname.replace(/\/+$/, "") || "/";
      const privateRoute = route === "/admin" || route.startsWith("/admin/") ||
        route === "/account" || route === "/cart" || route === "/order" ||
        route.startsWith("/order-success/") || route.startsWith("/invoice/") ||
        (route === "/track-order" && url.searchParams.has("token"));
      const robots = privateRoute ? "noindex,nofollow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
      const canonical = xmlEscape(new URL(route, url.origin).href);
      const canonicalTag = '<link rel="canonical" href="' + canonical + '"/>';
      const robotsTag = '<meta name="robots" content="' + robots + '"/>';
      const ogUrlTag = '<meta property="og:url" content="' + canonical + '"/>';
      if (/<link[^>]*rel=["']canonical["'][^>]*>/i.test(html)) html = html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/i, canonicalTag);
      else html = html.replace("</head>", canonicalTag + "</head>");
      if (/<meta[^>]*name=["']robots["'][^>]*>/i.test(html)) html = html.replace(/<meta[^>]*name=["']robots["'][^>]*>/i, robotsTag);
      else html = html.replace("</head>", robotsTag + "</head>");
      if (/<meta[^>]*property=["']og:url["'][^>]*>/i.test(html)) html = html.replace(/<meta[^>]*property=["']og:url["'][^>]*>/i, ogUrlTag);
      else html = html.replace("</head>", ogUrlTag + "</head>");
      const headers = new Headers(assetResponse.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      headers.delete("etag");
      return new Response(html, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
    }
    return assetResponse;
  }
};
