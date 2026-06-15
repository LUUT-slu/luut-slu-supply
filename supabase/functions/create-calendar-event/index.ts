import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EventPayload {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  calendarId?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Token refresh failed: ${text}`), { status: res.status });
  }
  const data = await res.json();
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return json({ error: "Google OAuth not configured on server" }, 503);
    }

    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

    const userId = userRes.user.id;

    const payload: EventPayload = await req.json();
    if (!payload.summary || !payload.start?.dateTime || !payload.end?.dateTime) {
      return json({ error: "summary, start.dateTime, and end.dateTime are required" }, 400);
    }

    const { data: tokenRow, error: tokenErr } = await admin
      .from("google_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .single();

    if (tokenErr || !tokenRow?.refresh_token) {
      return json(
        { error: "Google Calendar not connected. Sign out and sign back in with Google to grant calendar access." },
        403
      );
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(tokenRow.refresh_token, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    } catch (e: any) {
      if (e.status === 400 || e.status === 401) {
        // Refresh token revoked — clear it so the UI knows to prompt reconnect
        await admin.from("google_tokens").delete().eq("user_id", userId);
        await admin.from("customer_profiles").update({ calendar_connected: false }).eq("user_id", userId);
        return json(
          { error: "Calendar access was revoked. Sign out and sign back in with Google to reconnect." },
          401
        );
      }
      throw e;
    }

    const calendarId = payload.calendarId ?? "primary";
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: payload.summary,
          description: payload.description,
          location: payload.location,
          start: payload.start,
          end: payload.end,
        }),
      }
    );

    if (!calRes.ok) {
      const errText = await calRes.text();
      console.error("[create-calendar-event] Google error", calRes.status, errText);
      if (calRes.status === 401) {
        await admin.from("google_tokens").delete().eq("user_id", userId);
        await admin.from("customer_profiles").update({ calendar_connected: false }).eq("user_id", userId);
        return json(
          { error: "Calendar access expired. Sign out and sign back in with Google to reconnect." },
          401
        );
      }
      return json({ error: `Google Calendar error: ${calRes.status}` }, 502);
    }

    const event = await calRes.json();
    return json({ ok: true, eventId: event.id, htmlLink: event.htmlLink });
  } catch (e) {
    console.error("[create-calendar-event] error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
