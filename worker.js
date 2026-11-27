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
async function getActiveServiceCatalog(env) {
  try {
    return await db(env, "services?select=name,slug,description,category,smm_platform,smm_category,smm_price_per_1000,smm_min_quantity,smm_max_quantity,smm_refill,delivery_estimate,pricing_details&is_active=eq.true&order=sort_order.asc&limit=1000");
  } catch (error) {
    console.error("Service catalogue lookup failed", String(error).slice(0, 180));
    return [];
  }
}
function normalizeBotText(value) {
  return String(value || "").toLowerCase().replace(/[\s\p{P}]+/gu, " ").trim();
}
function getServiceMatchTerms(text) {
  const value = normalizeBotText(text);
  const groups = [
    ["tiktok", ["tiktok", "tik tok", "tt", "টিকটক"]],
    ["facebook", ["facebook", "fb", "ফেসবুক"]],
    ["instagram", ["instagram", "insta", "ig", "ইনস্টাগ্রাম"]],
    ["telegram", ["telegram", "tg", "টেলিগ্রাম"]],
    ["youtube", ["youtube", "yt", "ইউটিউব"]],
    ["followers", ["followers", "follower", "follow", "fol", "ফলোয়ার", "ফলোয়ার"]],
    ["likes", ["likes", "like", "লাইক"]],
    ["views", ["views", "view", "ভিউ"]],
    ["comments", ["comments", "comment", "কমেন্ট"]],
    ["subscribers", ["subscribers", "subscriber", "সাবস্ক্রাইবার"]],
    ["canva", ["canva", "ক্যানভা"]],
    ["capcut", ["capcut", "ক্যাপকাট"]],
    ["chatgpt", ["chatgpt", "chat gpt", "চ্যাটজিপিটি"]],
    ["gemini", ["gemini", "google ai", "জেমিনি"]],
    ["claude", ["claude", "ক্লড"]],
    ["passport", ["passport", "পাসপোর্ট"]],
    ["nid", ["nid", "national identity", "জাতীয় পরিচয়", "জাতীয় পরিচয়"]],
    ["birth certificate", ["birth certificate", "জন্ম নিবন্ধন", "জন্মনিবন্ধন"]],
    ["visa", ["visa", "ভিসা"]],
    ["air ticket", ["air ticket", "flight ticket", "টিকেট", "টিকিট"]],
    ["design", ["design", "poster", "logo", "graphic", "ডিজাইন", "পোস্টার", "লোগো"]],
    ["video editing", ["video editing", "editing", "ভিডিও এডিট"]],
    ["website", ["website", "web development", "web design", "ওয়েবসাইট", "ওয়েবসাইট"]]
  ];
  return groups.filter(([, terms]) => terms.some(term => value.includes(normalizeBotText(term)))).map(([key]) => key);
}
function findRelevantServices(catalog, userText) {
  const text = normalizeBotText(userText);
  const terms = getServiceMatchTerms(userText);
  const ranked = (catalog || []).map(service => {
    const fields = normalizeBotText([service.name, service.slug, service.description, service.category, service.smm_platform, service.smm_category].join(" "));
    let score = 0;
    for (const term of terms) {
      if (fields.includes(normalizeBotText(term))) score += 5;
      if (normalizeBotText(service.name + " " + service.slug).includes(normalizeBotText(term))) score += 4;
    }
    const stopWords = new Set(["service","services","servis","seba","please","pls","price","pricing","cost","rate","how","much","what","your","for","the","and","want","need","koto","dam","daam","taka","tk","ache","ase","gulo","gula","ki","apnader","amar","ami","bolen","janan"]);
    const words = text.split(" ").filter(word => word.length > 2 && !stopWords.has(word));
    for (const word of words) if (fields.includes(word)) score += 1;
    if (service.smm_platform && terms.includes(normalizeBotText(service.smm_platform))) score += 5;
    return { service, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (!terms.length && !text) return [];
  return ranked.slice(0, 8).map(item => item.service);
}
function formatServiceFacts(services) {
  return (services || []).map(service => {
    const parts = [String(service.name || service.slug || "Service")];
    if (service.category) parts.push("Category: " + service.category);
    if (service.description) parts.push("Details: " + String(service.description).slice(0, 240));
    if (service.smm_price_per_1000 !== null && service.smm_price_per_1000 !== undefined) parts.push("Selling price: ৳" + service.smm_price_per_1000 + " per 1,000");
    if (service.smm_min_quantity || service.smm_max_quantity) parts.push("Quantity range: " + (service.smm_min_quantity || "not listed") + "–" + (service.smm_max_quantity || "not listed"));
    if (service.smm_refill) parts.push("Refill: " + service.smm_refill);
    if (service.delivery_estimate) parts.push("Delivery estimate: " + service.delivery_estimate);
    if (service.pricing_details) parts.push("Package pricing notes: " + String(service.pricing_details).slice(0, 220));
    return parts.join(" | ");
  }).join("\n").slice(0, 5000);
}
async function makeReply(env, userText, settings, channel, conversationId = null) {
  const catalog = await getActiveServiceCatalog(env);
  const normalizedText = normalizeBotText(userText);
  const asksServices = /(?:what services|services do you offer|list (?:your )?services|available services|service list|ki ki service|ki ki servis|apnader service|apnader ki ki|service gulo|service gula|servis gulo|ki ki seba|ki ki kaj|what do you do|আপনাদের.*(?:সার্ভিস|সেবা)|কী কী.*(?:সার্ভিস|সেবা)|কি কি.*(?:সার্ভিস|সেবা)|সেবাসমূহ)/u.test(normalizedText);
  const asksPrice = /(?:price|pricing|cost|rate|how much|dam|daam|damer|koto|tk|taka|৳|দাম|কত টাকা|কত)/u.test(normalizedText);
  const relevantServices = findRelevantServices(catalog, userText);
  const isSmmPriceQuery = asksPrice && relevantServices.some(service => service.smm_price_per_1000 !== null && service.smm_price_per_1000 !== undefined);
  if (asksServices) {
    const categories = Array.from(new Set((catalog || []).map(service => service.category).filter(Boolean)));
    const examples = (catalog || []).slice(0, 12).map(service => service.name).filter(Boolean);
    const isBangla = /[\u0980-\u09ff]/u.test(userText) || /bangla|banglish/u.test(normalizedText);
    if (isBangla) return "আমাদের website-এ বর্তমানে " + (categories.length ? categories.join(", ") : "ডিজিটাল সাবস্ক্রিপশন, Meta/SMM, ডকুমেন্ট ও ক্রিয়েটিভ সার্ভিস") + " ক্যাটাগরির সার্ভিস আছে। কিছু সার্ভিসের উদাহরণ: " + examples.slice(0, 6).join(", ") + "। কোন সার্ভিসটি দরকার বললে সেটার বিস্তারিত ও বর্তমান দাম জানাতে পারব।";
    return "Our website currently lists services under " + (categories.length ? categories.join(", ") : "digital subscriptions, Meta/SMM, document assistance and creative services") + ". Examples include " + examples.slice(0, 6).join(", ") + ". Tell me which service you need and I can help with its details and current price.";
  }
  if (isSmmPriceQuery && relevantServices.length) {
    const priced = relevantServices.filter(service => service.smm_price_per_1000 !== null && service.smm_price_per_1000 !== undefined);
    if (priced.length) {
      const lines = priced.slice(0, 6).map(service => String(service.name) + " — ৳" + service.smm_price_per_1000 + " per 1,000" + (service.smm_refill ? " | Refill: " + service.smm_refill : ""));
      const isBangla = /[\u0980-\u09ff]/u.test(userText) || /bangla|banglish/u.test(normalizedText);
      return (isBangla ? "Website-এর বর্তমান rate:\n" : "Current website rates:\n") + lines.join("\n") + (priced.length > 1 ? (isBangla ? "\nআপনি কোন quality/package চান?" : "\nWhich quality/package are you looking for?") : "");
    }
  }
  let conversationHistory = [];
  if (channel === "messenger" && conversationId) {
    try {
      const rows = await db(env, "sdc_fb_automation_logs?select=input_text,ai_reply,created_at&conversation_id=eq." + encodeURIComponent(conversationId) + "&status=eq.replied&order=created_at.desc&limit=6");
      conversationHistory = (rows || []).reverse().filter(row => row?.input_text || row?.ai_reply).map(row => ({
        customer: String(row.input_text || "").slice(0, 450)
          .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
          .replace(/(?:\+?88)?01[3-9](?:[\s-]?\d){8}/g, "[phone removed]"),
        assistant: (() => {
          const previousReply = String(row.ai_reply || "");
          const leaked = /do not add extra information|do not use abbreviations|you are the official customer-support|customer message:/i.test(previousReply) || /(?:^|\n)\s*(?:BUSINESS|SERVICES|LANGUAGE|STYLE|ROUTING|ACCURACY|HUMAN SUPPORT|Additional business rules|Brand voice|Customer message|Return one complete)\s*:/i.test(previousReply);
          return leaked || previousReply.length > 700 ? "[previous reply was not usable; do not repeat it]" : previousReply.slice(0, 550);
        })()
      }));
    } catch (error) {
      console.error("Messenger context lookup failed", String(error).slice(0, 180));
    }
  }
  const prompt = [
    "You are the official customer-support representative of Stationery Dot Com, an online service platform in Bangladesh. Support the customer like a helpful human who understands short Banglish messages.",
    "BUSINESS FACTS: Services are delivered online/remotely. Do not provide or imply a physical office address or office visit. Contact support: 01827-680520.",
    "SERVICE FACTS: Use the live service catalogue below as the source of truth for service names, prices, quantity limits, refill and delivery details. If a detail is not in the catalogue or customer context, do not invent it. Do not claim an item is available unless it appears in the active catalogue.",
    "LANGUAGE: Reply in the customer's language. Banglish input should receive simple natural Bangla, not formal bookish Bangla. Keep English service names when clearer.",
    "UNDERSTANDING: Identify the customer's actual question before answering. Interpret common Banglish variants and typos by meaning. If a follow-up says 'eta', 'oita', 'etar dam', or similar, use the recent conversation to resolve the reference. If two services are plausible, ask one short clarification instead of guessing.",
    "STYLE: Direct, warm, human and concise (usually 1-3 short sentences). No slogans, long introductions, repeated greetings, irrelevant service lists or meta explanations. Answer first, then ask one relevant next question only if needed.",
    "PRICE RULES: Only quote prices present in the live catalogue. SMM prices are per 1,000 unless the catalogue says otherwise; do not confuse per-1,000 price with total order cost. For multiple quality tiers, show the relevant options and ask which one the customer wants.",
    "POLICY: Never promise followers/engagement retention, ad results, government approval, exact processing time, stock or refund outcome unless explicitly stated in the catalogue or confirmed by a human. Never ask for passwords, OTPs or payment PINs. For order status, refunds, complaints or account-specific matters, ask for order ID (not sensitive credentials) and direct to support if needed.",
    "BUSINESS RULES: " + (settings.business_rules || ""),
    "BRAND VOICE: " + (settings.brand_voice || ""),
    "CHANNEL: " + channel,
    "LIVE SERVICE CATALOGUE (use only relevant entries):\n" + (relevantServices.length ? formatServiceFacts(relevantServices) : "No exact service match was found. If the customer is asking about a service, ask one brief clarification or direct them to the website catalogue. If this is a greeting or general chat, answer naturally without forcing a service question.."),
    "RECENT CONVERSATION (oldest first; use only to resolve references; current message is latest): " + (conversationHistory.length ? JSON.stringify(conversationHistory) : "No usable prior messages."),
    "CUSTOMER MESSAGE: " + String(userText || "").slice(0, 1200),
    "Return one complete ready-to-send reply only. Do not output instructions, reasoning, labels or an unfinished sentence."
  ].join("\n");
  const result = await env.AI.run(AI_MODEL, { prompt, max_tokens: 260, temperature: 0.15 });
  const reply = String(result?.response || "").trim();
  if (!reply) throw new Error("AI returned an empty reply");
  const looksLikePromptLeak = /do not add extra information|do not use abbreviations|you are the official customer-support|customer message:|live service catalogue|business rules:/i.test(reply) || /(?:^|\n)\s*(?:BUSINESS FACTS|SERVICE FACTS|LANGUAGE|UNDERSTANDING|STYLE|PRICE RULES|POLICY|BRAND VOICE|CHANNEL|CUSTOMER MESSAGE)\s*:/i.test(reply);
  if (looksLikePromptLeak || reply.length > 700 || !/[.!?।]$/.test(reply)) {
    return "আপনার প্রশ্নটি বুঝেছি। সঠিক তথ্য দিতে আমাদের support team-এর সঙ্গে 01827-680520 নম্বরে যোগাযোগ করুন।";
  }
  return reply;
}
async function getSettings(env) {
  const rows = await db(env, "sdc_fb_automation_settings?select=*&id=eq.true&limit=1");
  return rows?.[0] || null;
}
async function logEvent(env, eventType, eventId, inputText, status, errorMessage = null, aiReply = null, conversationId = null) {
  if (!eventId) return;
  const existing = await db(env, "sdc_fb_automation_logs?select=id&external_event_id=eq." + encodeURIComponent(eventId) + "&limit=1");
  if (existing?.length) return false;
  await db(env, "sdc_fb_automation_logs", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ event_type: eventType, external_event_id: eventId, conversation_id: conversationId, input_text: inputText, status, error_message: errorMessage, ai_reply: aiReply })
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
  const inserted = await logEvent(env, channel, eventId, text, "received", null, null, conversation?.id || null);
  if (!inserted) return;
  try {
    const reply = await makeReply(env, text, settings, channel, conversation?.id || null);
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
    "/": ["Stationery Dot Com | Online Services Bangladesh", "Stationery Dot Com is a fully online Bangladesh service platform offering digital subscriptions, TikTok and social media services, Meta ads support, document assistance and creative services.", "Stationery Dot Com — Your Digital, Travel & Meta Solution Hub", "Explore our online services", "Stationery Dot Com helps customers in Bangladesh compare digital subscriptions, Meta and social media services, document assistance and creative work. Browse packages, review service terms and order online."],
    "/about": ["About Stationery Dot Com | Dhaka", "Learn about Stationery Dot Com, a fully online digital, travel and Meta solution hub serving customers across Bangladesh.", "About Stationery Dot Com", "Our business", "Stationery Dot Com is a fully online service provider offering digital subscriptions, Meta support, document assistance and creative services across Bangladesh. Customers can review service options and place orders remotely."],
    "/services": ["Online Services in Bangladesh | Stationery Dot Com", "Browse digital subscriptions, Meta and SMM services, document assistance and creative services at Stationery Dot Com.", "Online Services in Bangladesh", "Browse service categories", "Explore the services available from Stationery Dot Com. Compare package details, service scope and delivery terms before placing an order."],
    "/digital-subscriptions": ["Digital Subscriptions Bangladesh | Stationery Dot Com", "Compare available digital subscriptions in Bangladesh, including plan duration, access method and package terms.", "Digital Subscriptions in Bangladesh", "Digital tools and subscriptions", "Browse available digital subscription plans. Review duration, storage, access method, device limits and support terms on each package before ordering."],
    "/document-services": ["Document Assistance Bangladesh | Stationery Dot Com", "Explore document and government application assistance for birth certificates, NID, passports and trade licences in Bangladesh.", "Document & Application Assistance", "Document assistance services", "Stationery Dot Com provides assistance with online document applications and preparation. Requirements and government decisions depend on the relevant authority; review each service's scope before ordering."],
    "/meta-services": ["Meta Ads & Page Services Bangladesh | SDC", "Explore Facebook and Instagram page setup, Meta ads support and social media management services in Bangladesh.", "Meta Ads & Page Services", "Meta and social media support", "Review available Facebook and Instagram page setup, optimization, campaign support and management services. Advertising results depend on the campaign, audience and platform."],
    "/creative-services": ["Graphic Design & Video Editing | Stationery Dot Com", "Explore graphic design, video editing and web development services in Bangladesh with clear deliverables and package scope.", "Graphic Design, Video Editing & Web", "Creative and web services", "Stationery Dot Com offers graphic design, video editing and web development. Review deliverables, timelines and revision terms for each available package."],
    "/smm": ["SMM Panel Bangladesh | Stationery Dot Com", "Browse social media marketing services and review package details, delivery estimates and refill terms before ordering.", "Social Media Marketing Services", "Social media marketing services", "Compare available social media services by platform, quantity and package terms. Delivery and retention can vary by provider and platform."],
    "/contact": ["Contact Stationery Dot Com | Dhaka", "Contact Stationery Dot Com online for digital subscriptions, Meta support, document assistance and creative services across Bangladesh.", "Contact Stationery Dot Com", "Contact our team", "Contact Stationery Dot Com online for service information and order support. Our support team can help clarify available packages and requirements."],
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
      "smm-tiktok-likes-real": ["TikTok Likes Bangladesh | Stationery Dot Com", "Review TikTok likes service details, quantity limits, current price and No Refill terms before ordering."],
      "smm-tiktok-views-instant": ["TikTok Video Views Bangladesh | Stationery Dot Com", "Review TikTok video views service details, quantity limits, current price and No Refill terms before ordering."],
      "smm-tiktok-followers-low": ["TikTok Followers Low Quality (Bot) | Stationery Dot Com", "Review the TikTok follower service labelled low quality or bot, including quantity limits and No Refill terms."],
      "smm-tiktok-followers-medium": ["TikTok Followers Medium Quality | Stationery Dot Com", "Review TikTok medium-quality real-user follower service details, quantity limits and No Refill terms."],
      "smm-tiktok-followers-high": ["TikTok Followers High Quality | Stationery Dot Com", "Review TikTok high-quality real-active follower service details, quantity limits and No Refill terms."],
      "smm-tiktok-followers-premium": ["TikTok Followers Premium Real Users | Stationery Dot Com", "Review TikTok premium real-user follower service details, quantity limits and No Refill terms."],
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
    if (blog[1] === "tiktok-likes-views-followers-bangladesh-guide") return ["TikTok Likes, Views & Followers Bangladesh | Stationery Dot Com", "Understand TikTok likes, video views and follower service options in Bangladesh, including quality labels, quantity limits and No Refill terms.", "TikTok Likes, Views & Followers in Bangladesh: Order Guide", "TikTok service types, terms and safety checks", "Stationery Dot Com lists TikTok likes, video views and follower options with different quality labels. Quality labels describe the listing and do not guarantee engagement, retention, conversions or viral reach. Current TikTok service listings show No Refill terms. Check the live catalogue for current prices, minimum and maximum quantities, delivery estimates and requirements. Never share passwords or verification codes; provide only the public video or profile link requested. Use services only in ways consistent with TikTok rules and remember that no service guarantees organic growth or sales.", "Likes apply to a video; followers apply to a profile; views apply to video view counts. Review the service detail page before ordering and check the current platform policies."];
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
      const pageSection = '<section><h1>' + escapedH1 + '</h1><p>' + escapedIntro + '</p><p>Stationery Dot Com is a fully online service platform serving customers across Bangladesh. Review the service scope, package details, requirements and delivery information shown on each listing before placing an order.</p></section>';
      html = html.replace(/<section>\s*<h1>[\s\S]*?<\/section>/i, pageSection);
      const secondSection = '<section><h2>' + escapedH2 + '</h2><p>' + escapedSupport + '</p><p>For accurate availability, pricing and fulfilment, use the live package information on the website. If a service requires additional information, submit only what is requested for that order.</p><p><a href="/services">Browse all services</a> · <a href="/contact">Contact Stationery Dot Com</a> · <a href="/track-order">Track an order</a></p></section>';
      html = html.replace(/<section>\s*<h2>Online services with clear package details[\s\S]*?<\/section>/i, secondSection);
      const guideSectionPattern = /<section>\s*<h2>Helpful guides from Stationery Dot Com[\s\S]*?<\/section>/i;
      const guideLinks = '<section><h2>Helpful guides from Stationery Dot Com</h2><p>Practical Bangladesh-focused guides for customers:</p><ul><li><a href="/blog/personal-vs-shared-digital-subscription-guide">Personal vs Shared Digital Subscription Guide</a></li><li><a href="/blog/smm-panel-bangladesh-order-checklist">SMM Panel Bangladesh: Order Checklist</a></li><li><a href="/blog/nid-correction-preparation-checklist">NID Correction Preparation Checklist</a></li><li><a href="/blog/video-editing-footage-preparation-checklist">Video Editing Footage Preparation Checklist</a></li><li><a href="/blog/tiktok-likes-views-followers-bangladesh-guide">TikTok Likes, Views &amp; Followers: Order Guide</a></li></ul><p><a href="/blog">Read all guides and articles</a></p></section>';
      if (route === "/") {
        if (guideSectionPattern.test(html)) html = html.replace(guideSectionPattern, guideLinks);
        else html = html.replace("</main>", guideLinks + "</main>");
      } else {
        html = html.replace(guideSectionPattern, "");
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
