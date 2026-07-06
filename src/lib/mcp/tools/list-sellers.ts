declare const process: { env: Record<string, string | undefined> };
import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_sellers",
  title: "List sellers",
  description: "List approved sellers on Luut SLU, optionally filtered by location.",
  inputSchema: {
    location: z.string().optional().describe("Filter by seller location (e.g. Castries)."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results, default 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ location, limit }) => {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    let q = sb
      .from("seller_profiles")
      .select("id, seller_name, location, categories, storefront_slug")
      .eq("is_approved", true)
      .limit(limit ?? 20);
    if (location) q = q.ilike("location", `%${location}%`);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { sellers: data ?? [] },
    };
  },
});
