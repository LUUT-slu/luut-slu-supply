import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the Luut SLU marketplace catalog for active seller products by keyword and/or category.",
  inputSchema: {
    query: z.string().optional().describe("Keyword to match in product name or description."),
    category: z.string().optional().describe("Filter by category (e.g. Beanies, Hoodies)."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results, default 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, limit }) => {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    let q = sb
      .from("seller_products")
      .select("id, name, price, category, location, description, seller_id")
      .eq("status", "active")
      .limit(limit ?? 20);
    if (query) q = q.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    if (category) q = q.ilike("category", category);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
