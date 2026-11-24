import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["POST", "GET"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "Server configuration unavailable" }, 503);

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

    const { data: admin, error: adminError } = await supabase
      .from("admin_profiles")
      .select("id")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (adminError) return json({ error: "Could not verify admin access" }, 500);
    if (!admin) return json({ error: "Admin access required" }, 403);

    let sourceUrl = "";
    let path = "";
    if (req.method === "POST") {
      const body = await req.json();
      sourceUrl = String(body?.sourceUrl || "");
      path = String(body?.path || "");
    } else {
      const u = new URL(req.url);
      sourceUrl = u.searchParams.get("sourceUrl") || "";
      path = u.searchParams.get("path") || "";
    }
    if (!sourceUrl || sourceUrl.length > 2048 || !path || path.length > 240) {
      return json({ error: "A valid sourceUrl and storage path are required" }, 400);
    }

    let source: URL;
    try {
      source = new URL(sourceUrl);
    } catch {
      return json({ error: "Invalid source URL" }, 400);
    }
    const host = source.hostname.toLowerCase();
    const privateHost = host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      /^(?:127\.|10\.|192\.168\.|169\.254\.)/.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
      host === "[::1]" || host === "[::]";
    if (source.protocol !== "https:" || source.username || source.password || privateHost) {
      return json({ error: "Only public HTTPS image URLs are allowed" }, 400);
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:jpe?g|png|webp)$/i.test(path) ||
        path.split("/").some(part => !part || part === "." || part === "..")) {
      return json({ error: "Invalid image storage path" }, 400);
    }

    const res = await fetch(source.toString(), {
      redirect: "error",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StationeryDotCom/1.0)",
        "Accept": "image/png,image/jpeg,image/webp"
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return json({ error: "Source image fetch failed" }, 502);

    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) return json({ error: "Only JPG, PNG and WEBP images are accepted" }, 415);
    const declaredLength = Number(res.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) return json({ error: "Image exceeds the 5MB limit" }, 413);

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) {
      return json({ error: "Image is empty or exceeds the 5MB limit" }, 413);
    }

    const { error } = await supabase.storage.from("service-images").upload(path, bytes, {
      contentType,
      upsert: true,
      cacheControl: "31536000"
    });
    if (error) return json({ error: "Image upload failed" }, 500);

    return json({
      publicUrl: supabase.storage.from("service-images").getPublicUrl(path).data.publicUrl
    });
  } catch (error) {
    console.error("Service image import failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Image import failed. Please try again." }, 500);
  }
});
