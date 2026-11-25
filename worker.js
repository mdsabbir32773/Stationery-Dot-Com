const META_WEBHOOK_PATH = "/webhooks/meta";
const GRAPH_VERSION = "v27.0";
const SUPABASE_URL = "https://efrqreeyuopdvmghfedx.supabase.co";
const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

function secureResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function json(data, status = 200) {
  return secureResponse(new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } }));
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
    db(env, "blog_posts?select=slug,published_at,updated_at&status=eq.published&published_at=not.is.null&published_at=lte." + encodeURIComponent(now) + "&order=published_at.desc")
  ]);
  const origin = "https://stationerydotcom.me";
  const urls = new Map();
  const add = (path, lastmod = null) => {
    const loc = origin + path;
    urls.set(loc, lastmod ? String(lastmod).slice(0, 10) : null);
  };
  ["/", "/about", "/services", "/digital-subscriptions", "/document-services", "/meta-services", "/creative-services", "/smm", "/contact", "/track-order", "/help", "/blog", "/refund-policy", "/delivery-policy", "/privacy-policy", "/terms-of-service"].forEach(path => add(path));
  for (const service of services || []) {
    if (service?.slug && /^[a-z0-9-]+$/.test(service.slug)) add("/services/" + service.slug);
  }
  for (const post of posts || []) {
    if (post?.slug && /^[a-z0-9-]+$/.test(post.slug)) add("/blog/" + post.slug, post.updated_at || post.published_at);
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
async function publicSettings(env) {
  const allowed = new Set([
    "site_name", "logo_url", "site_tagline", "footer_description",
    "contact_phone", "contact_phone_2", "contact_whatsapp", "contact_hours",
    "contact_heading", "contact_intro"
  ]);
  try {
    const rows = await db(env, "site_settings?select=key,value");
    const settings = Object.fromEntries((rows || [])
      .filter(row => allowed.has(row.key))
      .map(row => [row.key, row.value]));
    return secureResponse(new Response(JSON.stringify(settings), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=600"
      }
    }));
  } catch (error) {
    console.error("Public settings endpoint failed:", String(error));
    return json({ error: "Public settings temporarily unavailable" }, 503);
  }
}

async function cachedPageRouteExists(path, env, ctx) {
  // Only service/blog slugs need a database lookup. Cache the boolean result
  // per Cloudflare colo for five minutes to reduce repeat Supabase round trips.
  if (!/^\/(?:services|blog)\/[a-z0-9-]+$/.test(path) || typeof caches === "undefined") {
    return isKnownPageRoute(path, env);
  }
  const cache = caches.default;
  const cacheKey = new Request("https://stationerydotcom.me/__route-check" + path);
  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const value = await cached.json();
      if (typeof value.exists === "boolean") return value.exists;
    }
  } catch {}
  const exists = await isKnownPageRoute(path, env);
  if (typeof exists === "boolean") {
    const response = new Response(JSON.stringify({ exists }), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" }
    });
    try {
      ctx.waitUntil(cache.put(cacheKey, response).catch(() => {}));
    } catch {}
  }
  return exists;
}

async function isKnownPageRoute(path, env) {
  const staticRoutes = new Set([
    "/", "/about", "/refund-policy", "/delivery-policy", "/services",
    "/digital-subscriptions", "/document-services", "/meta-services",
    "/creative-services", "/smm", "/order", "/cart", "/checkout",
    "/track-order", "/contact", "/help", "/blog", "/account",
    "/privacy-policy", "/terms-of-service", "/admin", "/admin/login"
  ]);
  if (staticRoutes.has(path)) return true;
  if (/^\/(?:invoice|order-success)\/[^/]+$/.test(path)) return true;
  if (/^\/admin\/(?:services|smm|deposits|packages|coupons|activity|support|content|settings|reviews|orders|customers)$/.test(path)) return true;
  if (/^\/admin\/(?:orders|customers)\/[^/]+$/.test(path)) return true;

  const serviceMatch = path.match(/^\/services\/([a-z0-9-]+)$/);
  if (serviceMatch) {
    try {
      const rows = await db(env, "services?select=id&slug=eq." + encodeURIComponent(serviceMatch[1]) + "&is_active=eq.true&limit=1");
      return Boolean(rows?.length);
    } catch {
      return null;
    }
  }
  const blogMatch = path.match(/^\/blog\/([a-z0-9-]+)$/);
  if (blogMatch) {
    try {
      const now = encodeURIComponent(new Date().toISOString());
      const rows = await db(env, "blog_posts?select=id&slug=eq." + encodeURIComponent(blogMatch[1]) + "&status=eq.published&published_at=not.is.null&published_at=lte." + now + "&limit=1");
      return Boolean(rows?.length);
    } catch {
      return null;
    }
  }
  return false;
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

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function routeSeo(route) {
  const pages = {
    "/": ["Stationery Dot Com | Online Services Bangladesh", "Stationery Dot Com in Dhaka offers digital subscriptions, Meta ads support, SMM, document assistance and creative services across Bangladesh.", "Stationery Dot Com — Your Digital, Travel & Meta Solution Hub", "Explore our online services", "Stationery Dot Com helps customers in Bangladesh compare digital subscriptions, Meta and social media services, document assistance and creative work. Browse packages, review service terms and order online."],
    "/about": ["About Stationery Dot Com | Dhaka", "Learn about Stationery Dot Com, a Dhaka-based digital, travel and Meta solution hub serving customers across Bangladesh.", "About Stationery Dot Com", "Our business", "Stationery Dot Com is a Dhaka-based online service provider offering digital subscriptions, Meta support, document assistance and creative services. Our team helps customers understand service options and place online orders."],
    "/services": ["Online Services in Bangladesh | Stationery Dot Com", "Browse digital subscriptions, Meta and SMM services, document assistance and creative services at Stationery Dot Com.", "Online Services in Bangladesh", "Browse service categories", "Explore the services available from Stationery Dot Com. Compare package details, service scope and delivery terms before placing an order."],
    "/digital-subscriptions": ["Digital Subscriptions Bangladesh | Stationery Dot Com", "Compare available digital subscriptions in Bangladesh, including plan duration, access method and package terms.", "Digital Subscriptions in Bangladesh", "Digital tools and subscriptions", "Browse available digital subscription plans. Review duration, storage, access method, device limits and support terms on each package before ordering."],
    "/document-services": ["Document Assistance Bangladesh | Stationery Dot Com", "Explore document and government application assistance for birth certificates, NID, passports and trade licences in Bangladesh.", "Document & Application Assistance", "Document assistance services", "Stationery Dot Com provides assistance with online document applications and preparation. Requirements and government decisions depend on the relevant authority; review each service's scope before ordering."],
    "/meta-services": ["Meta Ads & Page Services Bangladesh | SDC", "Explore Facebook and Instagram page setup, Meta ads support and social media management services in Bangladesh.", "Meta Ads & Page Services", "Meta and social media support", "Review available Facebook and Instagram page setup, optimization, campaign support and management services. Advertising results depend on the campaign, audience and platform."],
    "/creative-services": ["Graphic Design & Video Editing | Stationery Dot Com", "Explore graphic design, video editing and web development services in Bangladesh with clear deliverables and package scope.", "Graphic Design, Video Editing & Web", "Creative and web services", "Stationery Dot Com offers graphic design, video editing and web development. Review deliverables, timelines and revision terms for each available package."],
    "/smm": ["SMM Panel Bangladesh | Stationery Dot Com", "Browse social media marketing services and review package details, delivery estimates and refill terms before ordering.", "Social Media Marketing Services", "Social media marketing services", "Compare available social media services by platform, quantity and package terms. Delivery and retention can vary by provider and platform."],
    "/contact": ["Contact Stationery Dot Com | Dhaka", "Contact Stationery Dot Com in Dhaka for digital subscriptions, Meta support, document assistance and creative services.", "Contact Stationery Dot Com", "Contact our team", "Contact Stationery Dot Com for service information and order support. Our Dhaka team can help clarify available packages and requirements."],
    "/blog": ["Stationery Dot Com Blog | Bangladesh Guides", "Read practical Bangladesh-focused guides about online services, digital subscriptions, social media marketing and creative work.", "Stationery Dot Com Blog", "Helpful guides and updates", "Explore practical guides from Stationery Dot Com about online services, digital subscriptions, social media marketing, documents and creative work."],
    "/help": ["Help Center | Stationery Dot Com", "Find help with orders, payments, service delivery, documents and customer support at Stationery Dot Com.", "Stationery Dot Com Help Center", "Help with orders and services", "Find answers about placing orders, payments, delivery, document requirements and customer support. Contact our team if you need help with a specific order."],
    "/track-order": ["Track Your Order | Stationery Dot Com", "Track a Stationery Dot Com order using your order ID and phone number.", "Track Your Stationery Dot Com Order", "Order tracking", "Use your order details to check the latest status and updates for a Stationery Dot Com order."],
    "/delivery-policy": ["Delivery & Fulfilment Policy | Stationery Dot Com", "Understand how Stationery Dot Com handles digital service delivery, order status updates and support in Bangladesh.", "Delivery & Fulfilment Policy", "How order delivery works", "Delivery time and fulfilment depend on the service and package selected. Check the product page for the stated delivery estimate and requirements before ordering. After placing an order, use order tracking or contact support with your order ID if you need an update. Some services require customer-provided details or provider-side processing, so timelines may vary."],
    "/privacy-policy": ["Privacy Policy | Stationery Dot Com", "Read how Stationery Dot Com handles information submitted through online orders, account use and customer support.", "Privacy Policy", "Information and privacy", "When using Stationery Dot Com, provide only the information needed for your order or support request. Order and contact details may be used to process requests, provide updates and resolve service issues. Avoid sending passwords or sensitive account credentials through chat. Review the complete privacy policy on this page for the applicable details."],
    "/refund-policy": ["Refund & Cancellation Policy | Stationery Dot Com", "Review Stationery Dot Com's refund and cancellation terms before purchasing a digital subscription or online service.", "Refund & Cancellation Policy", "Before requesting a refund", "Refund eligibility can depend on the service type, fulfilment status, package terms and whether a provider has already processed the request. Read the applicable service terms before payment. If an order has a problem, contact support with your order ID and a clear description so the team can review it under the published policy."],
    "/terms-of-service": ["Terms of Service | Stationery Dot Com", "Read the terms for using Stationery Dot Com, placing orders and accessing digital or online services.", "Terms of Service", "Using our website and services", "By using Stationery Dot Com or placing an order, customers should review the service description, package limits, delivery estimates and any provider requirements. Customers are responsible for supplying accurate information and using services lawfully. Availability and processing may depend on third-party platforms or authorities; no result should be assumed unless stated in the specific package terms."]
  };
  const generic = ["Stationery Dot Com | Online Services Bangladesh", "Explore online services from Stationery Dot Com in Bangladesh. Review service details and package terms before ordering.", "Stationery Dot Com Online Services", "Service information", "Review the service details, package scope and terms provided by Stationery Dot Com before placing an order."];
  const supporting = {
    "/": "Customers can browse service categories, view package prices and requirements, place an order online, and follow order updates using the order tracking page.",
    "/about": "We aim to make online service ordering easier with clear package information, customer support and order-status updates. Stationery Dot Com is an independent service provider and is not a government office or an official representative of third-party platforms.",
    "/services": "The catalogue includes document assistance, digital subscriptions, Meta and social media support, SMM, and creative services. Each listing should be reviewed individually because requirements, pricing and fulfilment differ by service.",
    "/digital-subscriptions": "Before purchasing, compare the subscription duration, account ownership or sharing method, storage, device limits, warranty and activation steps. Provider terms and availability can change, so the package description at checkout is the reference for the order.",
    "/document-services": "For government-related requests, prepare accurate details and supporting documents before starting. Official eligibility, fees, appointments, processing and approval remain with the relevant government authority.",
    "/meta-services": "Advertising support may include page setup, campaign planning, audience selection and promotion management. Ad spend, creative assets, account access and platform approvals should be agreed before campaign work begins.",
    "/creative-services": "For a design or website request, provide the required copy, brand assets, dimensions, references, functionality and deadline. Confirm deliverables, revision rounds and ownership/hand-off details before the project starts.",
    "/smm": "Check the platform, service type, quantity range, start estimate, delivery estimate and refill or cancellation terms on each listing. Platform metrics can change and no engagement or business outcome should be guaranteed.",
    "/contact": "For faster support, include your order ID when asking about an existing order. Do not send account passwords, wallet PINs or one-time verification codes.",
    "/blog": "Articles are intended to help customers prepare for online services, understand package terms and make better decisions. For government processes or platform policies, verify current details with the relevant official source.",
    "/help": "Keep your order ID and the contact details used during checkout ready when contacting support. Payment receipt uploads are reviewed; uploading a receipt does not itself confirm payment.",
    "/track-order": "Enter the order details requested on the tracking page. If you cannot locate an order, contact support with the order ID and the phone number used at checkout.",
    "/delivery-policy": "Processing starts after required details and payment references are reviewed. Digital access, document assistance, creative work and third-party processing may have different fulfilment steps.",
    "/privacy-policy": "Use the website's account and order features only with information you are authorized to provide. The full policy describes the data collected, purposes, service providers and contact options.",
    "/refund-policy": "Contact support promptly if you need to cancel or believe fulfilment was incorrect. The team reviews the order status and published service terms before confirming available remedies.",
    "/terms-of-service": "Customers should check package scope and submit accurate, authorized information. Third-party providers and government authorities control their own platforms, decisions and processing times."
  };
  if (pages[route]) { pages[route][5] = supporting[route] || "Review the service-specific information, available package options and terms before placing an order."; return pages[route]; }
  const service = route.match(/^\/services\/([a-z0-9-]+)$/);
  if (service) {
    const serviceMeta = {
      "birth-certificate": ["Birth Certificate Support BD | Stationery Dot Com", "Birth certificate application and correction assistance in Bangladesh. Check required records and official registration rules before ordering."],
      "nid": ["NID Application & Correction BD | Stationery Dot Com", "Bangladesh National Identity Card application or correction assistance. Verify eligibility and documents with the Election Commission."],
      "passport": ["Passport Application Support BD | Stationery Dot Com", "Passport application assistance in Bangladesh. Confirm current fees, documents and appointments with the official passport authority."],
      "trade-license": ["Trade License Support BD | Stationery Dot Com", "Assistance with trade licence application or renewal in Bangladesh. Requirements and approval depend on the relevant local authority."],
      "canva": ["Canva Subscription BD | Stationery Dot Com", "Compare available Canva subscription packages in Bangladesh, including duration, account access and included plan terms."],
      "capcut-pro": ["CapCut Pro Subscription BD | Stationery Dot Com", "Review the available CapCut Pro subscription package in Bangladesh, including duration, device terms and activation method."],
      "chatgpt-go-plus": ["ChatGPT Go & Plus BD | Stationery Dot Com", "Compare ChatGPT Go and Plus subscription options in Bangladesh. Review plan, account eligibility and activation details."],
      "claude": ["Claude AI Subscription BD | Stationery Dot Com", "Explore Claude AI subscription options in Bangladesh. Check duration, access method and package conditions."],
      "gemini-ai-google-ai": ["Google AI & Gemini Subscription BD | Stationery Dot Com", "Review Google AI and Gemini subscription options, duration, storage and access method available in Bangladesh."],
      "spotify-premium": ["Spotify Premium BD | Stationery Dot Com", "Review Spotify Premium subscription options in Bangladesh and confirm current plan duration and account requirements."],
      "youtube-premium": ["YouTube Premium BD | Stationery Dot Com", "Compare YouTube Premium subscription options in Bangladesh and review package duration and access details."],
      "facebook": ["Facebook Page Setup BD | Stationery Dot Com", "Facebook Page setup and optimization support in Bangladesh for business information, profile setup and page presence."],
      "social-media-boosting-ads-run": ["Facebook & Instagram Ads BD | Stationery Dot Com", "Advertising support for Facebook and Instagram in Bangladesh, including campaign setup and promotion planning."],
      "social-media-page-management": ["Social Media Page Management BD | Stationery Dot Com", "Social media page management support for content updates, inbox handling and consistent brand communication."],
      "graphic-design": ["Graphic Design Services BD | Stationery Dot Com", "Graphic design for business branding, social media posts, marketing materials and print deliverables in Bangladesh."],
      "video-editing-creation": ["Video Editing Services BD | Stationery Dot Com", "Video editing for supplied footage, social media videos and business content. Review deliverables and revisions."],
      "web-design-development": ["Website Design & Development BD | Stationery Dot Com", "Website design and development for business sites, landing pages, blogs and online stores in Bangladesh."],
      "smm-fb-fol-ww": ["Facebook Followers Worldwide | Stationery Dot Com", "Review worldwide Facebook follower service quantity, price, delivery estimate and refill terms before ordering."],
      "smm-fb-fol-mix": ["Facebook Followers BD & Worldwide | Stationery Dot Com", "Compare mixed Bangladesh and worldwide Facebook follower options and check quantity, delivery and refill details."],
      "smm-fb-fol-bd-n": ["Facebook Followers Bangladesh | Stationery Dot Com", "Review Bangladesh Facebook follower service limits, current package price and fulfilment terms."],
      "smm-fb-fol-bd-p": ["Facebook Premium Followers BD | Stationery Dot Com", "Review Bangladesh premium Facebook follower service quantity, pricing and delivery terms."],
      "smm-fb-fol-bd-life": ["Facebook Followers BD Lifetime Refill | SDC", "Review Bangladesh Facebook follower service with lifetime refill terms and listed quantity limits."],
      "smm-fb-rea-ww": ["Facebook Reactions Worldwide | Stationery Dot Com", "Review worldwide Facebook reaction service options, quantity limits and listed pricing."],
      "smm-fb-rea-bd": ["Facebook Reactions Bangladesh | Stationery Dot Com", "Review Bangladesh Facebook reaction service options, quantity limits and listed pricing."],
      "smm-fb-reviews-genuine": ["Facebook Review Support | Stationery Dot Com", "Read the Facebook review service details and follow platform rules; reviews must reflect real customer experiences."],
      "smm-fb-views-nr": ["Facebook Video Views | Stationery Dot Com", "Review Facebook video and Reels view service quantity, price and no-refill terms."],
      "smm-fb-views-r1": ["Facebook Video Views with Refill | SDC", "Review Facebook video and Reels view service with one-time refill terms and quantity limits."],
      "smm-fb-com-rnd": ["Facebook Comments Service | Stationery Dot Com", "Review random Facebook comments service limits, pricing and order requirements."],
      "smm-fb-com-cus": ["Custom Facebook Comments | Stationery Dot Com", "Custom Facebook comments service details, required post information, quantity limits and pricing."],
      "smm-fb-com-pcus": ["Premium Custom Facebook Comments | SDC", "Review premium custom Facebook comments service requirements, quantity limits and pricing."],
      "smm-fb-shr-nr": ["Facebook Post Shares | Stationery Dot Com", "Review Facebook post shares service quantity, price and no-refill terms."],
      "smm-fb-shr-r1": ["Facebook Post Shares with Refill | SDC", "Review Facebook post shares service with one-time refill terms and quantity limits."],
      "smm-fb-shr-life": ["Facebook Post Shares Lifetime Refill | SDC", "Review Facebook post shares service with lifetime refill terms and listed price."],
      "smm-tg-mem-bot": ["Telegram Bot Members | Stationery Dot Com", "Review Telegram bot member service quantity, pricing and order requirements."],
      "smm-tg-mem-low": ["Telegram Members Low Quality | SDC", "Review Telegram low-quality member service quantity limits and listed pricing."],
      "smm-tg-mem-med": ["Telegram Members Medium Quality | SDC", "Review Telegram medium-quality member service quantity limits and listed pricing."],
      "smm-tg-mem-high": ["Telegram Members High Quality | SDC", "Review Telegram high-quality member service quantity limits and listed pricing."],
      "smm-ig-fol-real-bot": ["Instagram Followers Service | Stationery Dot Com", "Review Instagram follower service options, quantity limits, pricing and order terms."],
      "smm-ig-fol-old-post": ["Instagram Followers from Aged Accounts | SDC", "Review Instagram follower package described as aged accounts with posts, including quantity and pricing."],
      "smm-ig-fol-real-hq": ["Instagram High Quality Followers | SDC", "Review Instagram high-quality follower service quantity limits, pricing and order requirements."],
      "smm-ig-fol-old-post-r30": ["Instagram Followers 30-Day Refill | SDC", "Review Instagram follower package with aged accounts, posts and 30-day refill terms."]
    };
    const slug = service[1];
    const specific = {
      "birth-certificate": "This service supports customers with birth-certificate application or correction steps. Prepare the required identity and supporting documents, check spelling and information carefully, and confirm current requirements with the official registration authority.",
      "nid": "This service relates to Bangladesh National Identity Card application or correction assistance. Check eligibility, required documents and current instructions from the Election Commission before submitting an application.",
      "passport": "This service provides passport application assistance. Passport applications, biometric appointments, fees and processing are controlled by the Department of Immigration and Passports; verify current requirements through the official passport portal.",
      "canva": "Check the exact Canva plan, account access method, duration and device terms listed in the selected package. Do not share your password or one-time verification codes with anyone.",
      "capcut-pro": "Review the CapCut plan, duration, region availability and activation method shown in the package. Features and eligibility may vary by account, app version and region.",
      "chatgpt-go-plus": "Check the exact ChatGPT plan name, account eligibility, subscription duration and activation method shown at checkout. Plan features are controlled by OpenAI and may change; never share account passwords or verification codes.",
      "claude": "Review the Claude subscription duration, account access method and included features before ordering. Availability and plan limits are determined by the provider and may change.",
      "gemini-ai-google-ai": "Review the Google AI or Gemini subscription details, duration, storage and sharing/access method listed in the package. Confirm the Google account requirements and do not share your password or verification codes.",
      "graphic-design": "Graphic design orders should include the intended platform or print size, copy, brand assets, reference style and deadline. Confirm deliverables and revision terms before the work begins.",
      "smm-fb-reviews-genuine": "For review-related services, use only honest feedback from real customers and follow Meta's review policies. Do not purchase or post fabricated reviews or misrepresent customer experience."
    };
    const friendlyNames = {
      "birth-certificate": "Birth Certificate",
      "canva": "Canva",
      "capcut-pro": "CapCut Pro",
      "chatgpt-go-plus": "ChatGPT Go & Plus",
      "claude": "Claude AI",
      "facebook": "Facebook Page Setup",
      "gemini-ai-google-ai": "Gemini AI / Google AI",
      "graphic-design": "Graphic Design",
      "nid": "NID Application & Correction",
      "passport": "Passport Application Support",
      "trade-license": "Trade License",
      "social-media-boosting-ads-run": "Facebook & Instagram Ads Management",
      "social-media-page-management": "Social Media Page Management",
      "video-editing-creation": "Video Editing",
      "web-design-development": "Web Design & Development",
      "spotify-premium": "Spotify Premium",
      "youtube-premium": "YouTube Premium",
      "smm-fb-com-cus": "Facebook Comments — Custom",
      "smm-fb-com-pcus": "Facebook Comments — Premium Custom",
      "smm-fb-com-rnd": "Facebook Comments — Random",
      "smm-fb-fol-bd-life": "Facebook Followers — BD Premium Lifetime Refill",
      "smm-fb-fol-bd-n": "Facebook Followers — BD Normal",
      "smm-fb-fol-bd-p": "Facebook Followers — BD Premium",
      "smm-fb-fol-mix": "Facebook Followers — Bangladesh & Worldwide Mixed",
      "smm-fb-fol-ww": "Facebook Followers — Worldwide",
      "smm-fb-rea-bd": "Facebook Reactions — Bangladesh",
      "smm-fb-rea-ww": "Facebook Reactions — Worldwide",
      "smm-fb-reviews-genuine": "Facebook Reviews — Genuine Customer Reviews",
      "smm-fb-shr-life": "Facebook Shares — Lifetime Refill",
      "smm-fb-shr-nr": "Facebook Shares — No Refill",
      "smm-fb-shr-r1": "Facebook Shares — One Refill",
      "smm-fb-views-nr": "Facebook Video & Reels Views — No Refill",
      "smm-fb-views-r1": "Facebook Video & Reels Views — One Refill",
      "smm-ig-fol-old-post": "Instagram Followers — Aged Accounts with Posts",
      "smm-ig-fol-old-post-r30": "Instagram Followers — Aged Accounts with 30-Day Refill",
      "smm-ig-fol-real-bot": "Instagram Followers — Real & Bot",
      "smm-ig-fol-real-hq": "Instagram Followers — Real High Quality",
      "smm-tg-mem-bot": "Telegram Members — Bot",
      "smm-tg-mem-high": "Telegram Members — High Quality",
      "smm-tg-mem-low": "Telegram Members — Low Quality",
      "smm-tg-mem-med": "Telegram Members — Medium Quality",
      "smm-tg-mem-ultra-life": "Telegram Members — Ultra Lifetime Refill"
    };
    const name = friendlyNames[slug] || service[1].split("-").map((word, index) => {
      const lower = word.toLowerCase();
      const acronyms = { nid: "NID", smm: "SMM", fb: "Facebook", bd: "Bangladesh", ai: "AI", google: "Google", meta: "Meta", tiktok: "TikTok", youtube: "YouTube", chatgpt: "ChatGPT", capcut: "CapCut", canva: "Canva", pro: "Pro" };
      return acronyms[lower] || (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1));
    }).join(" ");
    const detail = specific[slug] || ("For " + name + ", compare the available package options, service quantity or duration, delivery estimate and any account or provider requirements shown on the product page. Check the included scope and support terms before placing an order.");
    const nextStep = slug === "birth-certificate" || slug === "nid" || slug === "passport" ? "Use the official authority's current instructions to confirm eligibility, fees and required documents. Our service is assistance only; the authority makes the final decision." : slug.startsWith("smm-") ? "Select a quantity within the listed limits and check start, delivery and refill terms. Use services responsibly and follow the platform's terms." : "Compare the listed packages and choose the duration or scope that matches your needs. Confirm account access, delivery steps and support conditions before checkout.";
    const meta = serviceMeta[slug] || [name + " Service Bangladesh | Stationery Dot Com", "Review " + name + " service options in Bangladesh. Compare package duration or quantity, current pricing, delivery estimate and fulfilment terms before ordering."];
    return [meta[0], meta[1], name + " Service in Bangladesh", "Package details and requirements", detail, nextStep];
  }
  const blog = route.match(/^\/blog\/([a-z0-9-]+)$/);
  if (blog) {
    const name = blog[1].split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    return [name + " | Stationery Dot Com", "Read this practical online service guide from Stationery Dot Com, with Bangladesh-focused information and useful next steps.", name, "Read this guide", "This Stationery Dot Com article provides practical information and steps related to " + name + ". Check official sources for current requirements and policy updates."];
  }
  return generic;
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
      return secureResponse(Response.redirect(url.toString(), 308));
    }
    if (url.pathname === "/checkout" && request.method === "GET") {
      url.pathname = "/cart";
      return secureResponse(Response.redirect(url.toString(), 308));
    }
    if (url.pathname === "/api/public-settings" && request.method === "GET") return publicSettings(env);
    if (url.pathname === "/sitemap.xml" && request.method === "GET") {
      try {
        return secureResponse(await dynamicSitemap(env));
      } catch (error) {
        console.error("Dynamic sitemap generation failed:", String(error));
        return secureResponse(await env.ASSETS.fetch(request));
      }
    }
    if (url.pathname === "/_internal/meta-webhook-setup" && request.method === "GET") {
      if (url.searchParams.get("key") !== env.META_VERIFY_TOKEN) return secureResponse(new Response("Forbidden", { status: 403 }));
      return secureResponse(await setupMetaWebhooks(env));
    }
    if (url.pathname === META_WEBHOOK_PATH) {
      if (request.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token && token === env.META_VERIFY_TOKEN && challenge) return secureResponse(new Response(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } }));
        return secureResponse(new Response("Forbidden", { status: 403 }));
      }
      if (request.method === "POST") {
        const rawBody = await request.text();
        if (!(await verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), env.META_APP_SECRET))) return json({ error: "Invalid webhook signature" }, 401);
        let payload;
        try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON payload" }, 400); }
        ctx.waitUntil(processWebhook(env, payload).catch(error => console.error("Meta webhook processing failed", String(error))));
        return json({ received: true });
      }
      return secureResponse(new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, POST" } }));
    }
    const acceptsHtml = request.method === "GET" && (request.headers.get("accept") || "").includes("text/html");
    const isPageRoute = !url.pathname.split("/").pop()?.includes(".");
    const route = url.pathname.replace(/\/+$/, "") || "/";
    const routeExists = acceptsHtml && isPageRoute ? await cachedPageRouteExists(route, env, ctx) : null;
    const assetResponse = await env.ASSETS.fetch(request);
    if (acceptsHtml && isPageRoute && assetResponse.headers.get("content-type")?.includes("text/html")) {
      let html = await assetResponse.text();
      // Canonical SEO host and indexability rules are covered by the public browser smoke test.
      // Public category landing pages are also covered by the SEO smoke suite.
      // Meta and creative service landing pages share the same canonical and indexability rules.
      // Service detail pages link back to their matching category landing pages.
      // Search favicon format and public asset delivery are covered by the smoke suite.
      // WebSite site-name schema is emitted only for the canonical homepage.
      if (route !== "/") {
        const schemaMatch = html.match(/<script id="stationery-seo-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/i);
        if (schemaMatch) {
          try {
            const schema = JSON.parse(schemaMatch[1]);
            if (Array.isArray(schema["@graph"])) {
              schema["@graph"] = schema["@graph"].filter(node => node["@type"] === "Organization");
              html = html.replace(schemaMatch[0], '<script id="stationery-seo-jsonld" type="application/ld+json">' + JSON.stringify(schema) + '</script>');
            }
          } catch {}
        }
      }
      const seo = routeSeo(route);
      const titleTag = "<title>" + escapeHtml(seo[0]) + "</title>";
      if (/<title>[\s\S]*?<\/title>/i.test(html)) html = html.replace(/<title>[\s\S]*?<\/title>/i, titleTag);
      else html = html.replace("</head>", titleTag + "</head>");
      const descriptionTag = '<meta name="description" content="' + escapeHtml(seo[1]) + '"/>';
      if (/<meta[^>]*name=["']description["'][^>]*>/i.test(html)) html = html.replace(/<meta[^>]*name=["']description["'][^>]*>/i, descriptionTag);
      else html = html.replace("</head>", descriptionTag + "</head>");
      const ogTitle = '<meta property="og:title" content="' + escapeHtml(seo[0]) + '"/>';
      const ogDescription = '<meta property="og:description" content="' + escapeHtml(seo[1]) + '"/>';
      const twitterTitle = '<meta name="twitter:title" content="' + escapeHtml(seo[0]) + '"/>';
      const twitterDescription = '<meta name="twitter:description" content="' + escapeHtml(seo[1]) + '"/>';
      for (const [pattern, tag] of [
        [/<meta[^>]*property=["']og:title["'][^>]*>/i, ogTitle],
        [/<meta[^>]*property=["']og:description["'][^>]*>/i, ogDescription],
        [/<meta[^>]*name=["']twitter:title["'][^>]*>/i, twitterTitle],
        [/<meta[^>]*name=["']twitter:description["'][^>]*>/i, twitterDescription]
      ]) {
        if (pattern.test(html)) html = html.replace(pattern, tag);
        else html = html.replace("</head>", tag + "</head>");
      }
      const escapedH1 = escapeHtml(seo[2]);
      const escapedH2 = escapeHtml(seo[3]);
      const escapedIntro = escapeHtml(seo[4]);
      const escapedSupport = escapeHtml(seo[5] || "Review the service-specific information, available package options and terms before placing an order.");
      const pageSection = '<section><h1>' + escapedH1 + '</h1><p>' + escapedIntro + '</p><p>Stationery Dot Com is based in Dhaka, Bangladesh. Review the service scope, package details, requirements and delivery information shown on each listing before placing an order.</p></section>';
      html = html.replace(/<section>\s*<h1>[\s\S]*?<\/section>/i, pageSection);
      const secondSection = '<section><h2>' + escapedH2 + '</h2><p>' + escapedSupport + '</p><p>For accurate availability, pricing and fulfilment, use the live package information on the website. If a service requires additional information, submit only what is requested for that order.</p><p><a href="/services">Browse all services</a> · <a href="/contact">Contact Stationery Dot Com</a> · <a href="/track-order">Track an order</a></p></section>';
      html = html.replace(/<section>\s*<h2>Online services with clear package details[\s\S]*?<\/section>/i, secondSection);
      if (route === "/") {
        const guideLinks = '<section><h2>Helpful guides from Stationery Dot Com</h2><p>Practical Bangladesh-focused guides for customers:</p><ul><li><a href="/blog/personal-vs-shared-digital-subscription-guide">Personal vs Shared Digital Subscription Guide</a></li><li><a href="/blog/smm-panel-bangladesh-order-checklist">SMM Panel Bangladesh: Order Checklist</a></li><li><a href="/blog/nid-correction-preparation-checklist">NID Correction Preparation Checklist</a></li><li><a href="/blog/video-editing-footage-preparation-checklist">Video Editing Footage Preparation Checklist</a></li></ul><p><a href="/blog">Read all guides and articles</a></p></section>';
        html = html.replace("</main>", guideLinks + "</main>");
      }
      const privateRoute = routeExists === false || route === "/admin" || route.startsWith("/admin/") ||
        route === "/account" || route === "/cart" || route === "/order" || route === "/checkout" ||
        route === "/order-success" || route.startsWith("/order-success/") ||
        route === "/invoice" || route.startsWith("/invoice/") ||
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
      headers.set("cache-control", privateRoute ? "no-store" : "no-cache, must-revalidate");
      return secureResponse(new Response(html, { status: routeExists === false ? 404 : assetResponse.status, statusText: routeExists === false ? "Not Found" : assetResponse.statusText, headers }));
    }
    return secureResponse(assetResponse);
  }
};
