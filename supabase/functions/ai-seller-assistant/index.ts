import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT_PER_HOUR = 30;

function getSystemPrompt(mode: string, context: Record<string, unknown> = {}): string {
  const base = `You are a smart AI assistant for sellers on Luut SLU — a marketplace platform in Saint Lucia. You help sellers manage their business on the platform.

Platform context:
- Luut SLU is a marketplace connector for streetwear and fashion in Saint Lucia
- Payment model: "Pay on Meetup" — cash payments at safe locations
- Meetup locations: Castries, Gros Islet, Vieux Fort, Rodney Bay
- Currency: Eastern Caribbean Dollar (XCD / EC$)
- Sellers handle their own meetups and customer communications via WhatsApp
- Product categories: Beanies, Hats, Ski Masks, Shirts/Tops, Hoodies/Outerwear, Pants/Bottoms, Shorts, Shoes/Footwear, Bags/Backpacks, Accessories, Jewelry, Watches, Sunglasses

Keep responses concise, practical, and actionable. Use a helpful and encouraging tone.`;

  switch (mode) {
    case "listing":
      return `${base}

You are the Listing Assistant. Help sellers create compelling product listings.
You can help with:
- Product title generation and refinement
- Product description writing (max 200 characters, casual and appealing)
- Short captions for social media
- Feature bullet points
- Category suggestions
- Cleaning up messy seller input
- Pricing guidance based on category norms

The seller's product info: ${JSON.stringify(context.productInfo || {})}

When generating listings, always output structured sections:
**Title:** (clean, searchable)
**Description:** (max 200 chars, appealing)
**Caption:** (short social media caption)
**Features:** (3-4 bullet points)
**Category suggestion:** (from platform categories)

Tone options the seller may request: clean/professional, simple/direct, premium, streetwear/fashion-focused.
Default to streetwear/fashion-focused unless told otherwise.`;

    case "order":
      return `${base}

You are the Order Assistant. Help sellers manage their orders efficiently.
You can help with:
- Summarizing order activity and status
- Identifying orders needing action
- Drafting customer messages (WhatsApp-friendly format)
- Pickup reminder drafts
- Issue resolution message drafts
- Spotting overdue or unconfirmed orders

Current seller orders context: ${JSON.stringify(context.orderSummary || {})}

When drafting messages, keep them WhatsApp-friendly: short, clear, with emojis where appropriate.
Always include order number and key details in messages.`;

    case "rewrite":
      return `${base}

You are the Message Rewriter. Help sellers improve their customer messages.
Rewrite the given text in the requested tone. Available tones:
- casual: friendly and relaxed
- professional: clean and polished
- friendly: warm and approachable
- confident: sales-focused and assertive

Keep the same meaning but improve clarity and tone. Output ONLY the rewritten text, nothing else.`;

    case "general":
    default:
      return `${base}

You are the Seller Assistant. Help sellers with general business questions and platform guidance.
You can help with:
- How to create better listings
- How to improve product photos
- Pricing strategies and positioning
- Customer communication tips
- Store optimization advice
- Selling tips for the St. Lucia market
- Platform feature explanations
- Simple business advice

The seller's store info: ${JSON.stringify(context.storeInfo || {})}

Be practical and specific. Give actionable tips, not generic advice.`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN not configured");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await sb.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Verify seller status
    const { data: sellerProfile } = await sb
      .from("seller_profiles")
      .select("id, seller_name, is_approved, location, categories")
      .eq("user_id", userId)
      .eq("is_approved", true)
      .single();

    if (!sellerProfile) {
      return new Response(JSON.stringify({ error: "Only approved sellers can use AI features" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting check
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSb = createClient(supabaseUrl, serviceRoleKey);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await adminSb
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo);

    if ((count || 0) >= RATE_LIMIT_PER_HOUR) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a few minutes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, mode = "general", context = {}, stream = true } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich context based on mode
    const enrichedContext: Record<string, unknown> = { ...context };

    if (mode === "order") {
      const { data: orders } = await sb
        .from("orders")
        .select("id, order_number, customer_name, status, order_status, total_price, location, preferred_date, pickup_time, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      enrichedContext.orderSummary = {
        total: orders?.length || 0,
        pending: orders?.filter(o => o.order_status === "NEW" || o.status === "pending").length || 0,
        confirmed: orders?.filter(o => o.order_status === "CONFIRMED" || o.status === "confirmed").length || 0,
        completed: orders?.filter(o => o.order_status === "COMPLETED" || o.status === "completed").length || 0,
        recentOrders: orders?.slice(0, 10).map(o => ({
          number: `#L${String(o.order_number).padStart(4, "0")}`,
          customer: o.customer_name,
          status: o.order_status || o.status,
          total: `EC$${o.total_price}`,
          location: o.location,
          date: o.preferred_date,
          time: o.pickup_time,
        })),
      };
    }

    if (mode === "general" || mode === "listing") {
      const { data: products } = await sb
        .from("seller_products")
        .select("name, price, category, status, views_count, clicks_count")
        .eq("seller_id", sellerProfile.id)
        .limit(20);

      enrichedContext.storeInfo = {
        sellerName: sellerProfile.seller_name,
        location: sellerProfile.location,
        categories: sellerProfile.categories,
        activeProducts: products?.filter(p => p.status === "active").length || 0,
        totalProducts: products?.length || 0,
        products: products?.map(p => ({
          name: p.name,
          price: `EC$${p.price}`,
          category: p.category,
          views: p.views_count,
          clicks: p.clicks_count,
        })),
      };
    }

    const systemPrompt = getSystemPrompt(mode, enrichedContext);

    // Log usage
    await adminSb.from("ai_usage_logs").insert({
      user_id: userId,
      feature: mode,
      tokens_used: 0,
    });

    const aiResponse = await fetch("https://openai-compat.replicate.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI service rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, t);
      throw new Error("AI service error");
    }

    if (stream) {
      return new Response(aiResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else {
      const data = await aiResponse.json();
      const content = data.choices?.[0]?.message?.content?.trim() || "";
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("ai-seller-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
