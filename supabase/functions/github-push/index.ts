import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toBase64(str: string) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { path, content, message } = await req.json();
    if (!path || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "Missing path or content" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: conn, error: connErr } = await admin
      .from("github_connections")
      .select("access_token, repo_full_name, github_username")
      .eq("user_id", userId)
      .maybeSingle();
    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: "GitHub not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!conn.repo_full_name) {
      return new Response(JSON.stringify({ error: "No target repo configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ghHeaders = {
      "Authorization": `Bearer ${conn.access_token}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "ds-track",
    };
    const baseUrl = `https://api.github.com/repos/${conn.repo_full_name}/contents/${path}`;

    let sha: string | undefined;
    const existing = await fetch(baseUrl, { headers: ghHeaders });
    if (existing.status === 200) {
      const existingJson = await existing.json();
      sha = existingJson.sha;
    } else if (existing.status !== 404) {
      const detail = await existing.text();
      return new Response(JSON.stringify({ error: "GitHub lookup failed", detail }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const putResp = await fetch(baseUrl, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message || `Update ${path}`,
        content: toBase64(content),
        sha,
      }),
    });
    const putJson = await putResp.json();
    if (!putResp.ok) {
      return new Response(JSON.stringify({ error: "GitHub write failed", detail: putJson }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, html_url: putJson.content?.html_url, commit_sha: putJson.commit?.sha }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
