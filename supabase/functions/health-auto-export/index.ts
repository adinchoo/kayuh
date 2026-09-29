// supabase/functions/garmin-connector/index.ts
// Dreeve Garmin Connector ported to Supabase Edge Function (Deno)
// Logic: Garmin Connect -> list -> download.fit -> parse -> import
// Env: GARMIN_EMAIL, GARMIN_PASSWORD (or per-user table), SINCE=-30d

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GARMIN_EMAIL = Deno.env.get("GARMIN_EMAIL");
const GARMIN_PASSWORD = Deno.env.get("GARMIN_PASSWORD");
const SINCE = Deno.env.get("SINCE") || "-30d";
const MAX_DOWNLOADS = parseInt(Deno.env.get("MAX_DOWNLOADS_PER_CYCLE") || "25");
const DOWNLOAD_DELAY = parseInt(Deno.env.get("DOWNLOAD_DELAY_SECONDS") || "2");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ---- Garmin Unofficial API helpers (python-garminconnect JS port) ----
async function garminLogin(email: string, password: string) {
  // Step 1: Get SSO pre-auth
  const loginUrl = "https://sso.garmin.com/sso/signin";
  const params = new URLSearchParams({
    service: "https://connect.garmin.com/modern",
    clientId: "GarminConnect",
    consumeServiceTicket: "false",
  });
  // Simplified flow - using garminconnect library endpoint mimic
  const res = await fetch(`${loginUrl}?${params}`, {
    headers: { "User-Agent": "Dreeve-Garmin-Connector/1.0" },
  });
  const html = await res.text();
  const ltMatch = html.match(/name="_eventId" value="([^"]+)"|name="lt" value="([^"]+)"/);
  // For Edge Function, we use direct API via https://connect.garmin.com modern auth
  // This is the stable endpoint used by dreeveapp connector
  const authRes = await fetch("https://sso.garmin.com/sso/signin", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: email,
      password: password,
      _eventId: "submit",
    }),
  });
  const cookies = authRes.headers.getSetCookie?.() || [];
  const ticket = authRes.headers.get("location")?.match(/ticket=([^&]+)/)?.[1];
  if (!ticket) throw new Error("Garmin login failed - check email/password, may need 2FA disable");

  // Exchange ticket for session
  const sessionRes = await fetch(`https://connect.garmin.com/modern?ticket=${ticket}`);
  const sessionCookies = sessionRes.headers.getSetCookie?.() || [...cookies];

  return { cookies: sessionCookies.join("; "), ticket };
}

async function listActivities(cookies: string, sinceDate: Date) {
  // Garmin Connect activities endpoint
  const url = `https://connect.garmin.com/modern/proxy/activity-service/activities/search/activities?start=0&limit=100&startDate=${sinceDate.toISOString().split('T')[0]}`;
  const res = await fetch(url, { headers: { Cookie: cookies, "User-Agent": "Dreeve" } });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error(`List failed ${res.status}`);
  return await res.json(); // array of activities
}

async function downloadFit(cookies: string, activityId: number): Promise<Uint8Array> {
  const url = `https://connect.garmin.com/modern/proxy/download-service/files/activity/${activityId}`;
  const res = await fetch(url, { headers: { Cookie: cookies } });
  if (!res.ok) throw new Error(`Download ${activityId} failed ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function parseSince(s: string): Date {
  if (s === "now") return new Date();
  if (s.match(/^-?\d+d$/)) { const d = parseInt(s); const dt = new Date(); dt.setDate(dt.getDate()+d); return dt; }
  if (s.match(/^-?\d+h$/)) { const h = parseInt(s); const dt = new Date(); dt.setHours(dt.getHours()+h); return dt; }
  return new Date(s);
}

// ---- Token storage (like./garmin/tokens in Dreeve) ----
async function getStoredTokens(userId: string) {
  const { data } = await supabase.from("garmin_tokens").select("*").eq("user_id", userId).single();
  return data;
}
async function saveTokens(userId: string, cookies: string) {
  await supabase.from("garmin_tokens").upsert({ user_id: userId, cookies, updated_at: new Date().toISOString() });
}

// ---- Main handler ----
serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  // CORS
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });

  try {
    const { user_id, email, password } = await req.json().catch(() => ({}));
    if (!user_id) throw new Error("user_id required");

    // === LOGIN - like `docker compose run --rm garmin-connector login` ===
    if (path === "login" || url.searchParams.get("action") === "login") {
      const e = email || GARMIN_EMAIL;
      const p = password || GARMIN_PASSWORD;
      if (!e ||!p) throw new Error("GARMIN_EMAIL/PASSWORD missing");
      const session = await garminLogin(e, p);
      await saveTokens(user_id, session.cookies);
      // also save to./garmin/tokens equivalent: storage
      return Response.json({ ok: true, message: "Garmin session stored, you can remove password now", healthy: true });
    }

    // === STATUS - like `dreeve-garmin-connector status` ===
    if (path === "status") {
      const { data: ledger } = await supabase.from("garmin_sync_state").select("*").eq("user_id", user_id).single();
      const { data: tokens } = await supabase.from("garmin_tokens").select("updated_at").eq("user_id", user_id).single();
      return Response.json({
        healthy:!!tokens,
        authentication: tokens? "ok" : "missing - run login",
        lastSuccessfulSync: ledger?.last_success_at || null,
        nextRunAt: ledger?.next_run_at || null,
        backlog: ledger?.backlog || 0,
        lastCycle: ledger?.last_cycle || null,
        config: { SINCE, MAX_DOWNLOADS_PER_CYCLE: MAX_DOWNLOADS }
      });
    }

    // === SYNC - like `sync-once` + hourly cron ===
    // GET /sync?dry_run=true -> like --dry-run
    const dryRun = url.searchParams.get("dry_run") === "true";
    const stored = await getStoredTokens(user_id);
    if (!stored) throw new Error("No Garmin session - call action=login first");

    const sinceDate = parseSince(SINCE);
    console.log(`Listing since ${sinceDate.toISOString()}`);

    let activities: any[] = [];
    try {
      activities = await listActivities(stored.cookies, sinceDate);
    } catch (e: any) {
      if (e.message.includes("401") || e.message.includes("403")) {
        return Response.json({ healthy: false, error: "Session expired - re-login required" }, { status: 401 });
      }
      throw e;
    }

    // Ledger logic - avoid re-downloading (like Dreeve's STATE_DIR ledger)
    const { data: existing } = await supabase.from("activity_logs").select("external_id").eq("user_id", user_id).eq("source", "Garmin");
    const existingIds = new Set((existing||[]).map((r:any)=>r.external_id));

    const toDownload = activities.filter((a:any)=>!existingIds.has(String(a.activityId))).slice(0, MAX_DOWNLOADS);
    console.log(`Listed ${activities.length}, backlog ${activities.length-existingIds.size}, downloading ${toDownload.length}`);

    if (dryRun) {
      return Response.json({ listed: activities.length, wouldDownload: toDownload.map((a:any)=>a.activityId), backlog: activities.length-existingIds.size });
    }

    let delivered = 0, failed = 0;
    for (const act of toDownload) {
      try {
        const fitBytes = await downloadFit(stored.cookies, act.activityId);
        // Store FIT to Supabase Storage (replaces./watch/<id>.fit)
        const fileName = `${user_id}/${act.activityId}.fit`;
        await supabase.storage.from("gpx-tracks").upload(fileName, fitBytes, { upsert: true, contentType: "application/octet-stream" });

        // Parse FIT using your existing Integrations.importFit logic (client will do full parse)
        // Here we insert basic activity + let app.js parse full elevation/HR later
        const start = act.startTimeLocal || act.startTimeGMT;
        await supabase.from("activity_logs").insert({
          user_id,
          external_id: String(act.activityId),
          activity_name: act.activityName || act.activityType?.typeKey || "Workout",
          duration_minutes: Math.round((act.duration||0)/60),
          moving_time_minutes: Math.round((act.movingDuration||act.duration||0)/60),
          distance_km: (act.distance||0)/1000,
          elevation_gain_m: act.elevationGain||0,
          avg_hr: act.averageHR||null,
          max_hr: act.maxHR||null,
          calories_burned: act.calories||0,
          source: "Garmin",
          has_gpx: true,
          logged_at: new Date(start).toISOString()
        });

        // Update gpx_tracks placeholder (full points parsed later by gpx-report.js)
        await supabase.from("gpx_tracks").insert({
          user_id,
          file_name: `${act.activityId}.fit`,
          distance_m: act.distance||0,
          elevation_gain: act.elevationGain||0
        });

        delivered++;
        await new Promise(r=>setTimeout(r, DOWNLOAD_DELAY*1000));
      } catch (err) {
        console.error(`Failed ${act.activityId}`, err);
        failed++;
      }
    }

    // Save state like Dreeve daemon
    await supabase.from("garmin_sync_state").upsert({
      user_id,
      last_success_at: new Date().toISOString(),
      last_cycle: { listed: activities.length, delivered, failed, backlog: activities.length-existingIds.size-delivered },
      backlog: Math.max(0, activities.length-existingIds.size-delivered),
      next_run_at: new Date(Date.now()+3600*1000).toISOString()
    });

    return Response.json({ ok: true, listed: activities.length, delivered, failed, backlog: activities.length-existingIds.size-delivered });

  } catch (e:any) {
    console.error(e);
    return Response.json({ error: e.message, healthy: false }, { status: 500 });
  }
});