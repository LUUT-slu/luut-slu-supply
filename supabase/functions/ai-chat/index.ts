import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the Luut SLU shopping assistant — a friendly, knowledgeable helper for an online marketplace based in Saint Lucia.

About Luut SLU:
- A marketplace platform connecting customers with verified local sellers
- Located in Saint Lucia (Caribbean)
- Payment: "Pay on Meetup" — customers meet sellers in person and pay cash
- Meetup locations: Castries (Central), Gros Islet (North), Vieux Fort (South), Rodney Bay
- Categories: Beanies, Hats, Ski Masks/Face Coverings, Shirts/Tops, Hoodies/Outerwear, Pants/Bottoms, Shorts, Shoes/Footwear, Bags/Backpacks, Accessories, Jewelry, Watches, Sunglasses
- Currency: Eastern Caribbean Dollar (XCD / EC$)
- Every seller is verified before joining

Policies:
- Deposits only for pre-orders and item holds
- Refunds handled case-by-case, contact seller via WhatsApp
- Sellers arrange meetups directly with customers

Your role:
- Help customers find products, answer questions about the platform
- Be concise, warm, and local in tone
- If asked about specific products, use the catalog info provided
- Never make up product details — say you'll check if unsure
- Keep responses short (2-3 sentences max unless detail is needed)`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch some products for context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: products } = await sb
      .from("seller_products")
      .select("name, price, category, location, description")
      .eq("status", "active")
      .limit(30);

    const catalogContext = products?.length
      ? `\n\nCurrent catalog (${products.length} products):\n${products.map(p => `- ${p.name}: EC$${p.price} (${p.category || "uncategorized"}${p.location ? ", " + p.location : ""})`).join("\n")}`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + catalogContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
