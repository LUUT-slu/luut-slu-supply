import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_DOMAIN = Deno.env.get("SHOPIFY_STORE_DOMAIN") || "lovable-project-yf43m.myshopify.com";
const SHOPIFY_TOKEN = Deno.env.get("SHOPIFY_ADMIN_TOKEN")!;
const API_VERSION = "2025-07";

const PRODUCTS_QUERY = `
  query ImportProducts($first: Int!, $cursor: String) {
    products(first: $first, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          vendor
          featuredImage { url }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                selectedOptions { name value }
                image { url }
                inventoryItem {
                  unitCost { amount }
                  inventoryLevels(first: 20) {
                    edges {
                      node {
                        location { id name }
                        quantities(names: ["available"]) { name quantity }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function shopifyGraphQL(query: string, variables: any) {
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

interface VariantRow {
  productId: string;
  productTitle: string;
  productImage: string | null;
  variantId: string;
  variantTitle: string;
  sku: string | null;
  price: number;
  cost: number;
  image: string | null;
  color: string | null;
  size: string | null;
  other: string | null;
  qty: number;
}
type GroupKey = string; // `${vendor}__${locationId}`
interface Group {
  vendor: string;
  locationId: string;
  locationName: string;
  products: Map<string, { title: string; image: string | null; variants: VariantRow[] }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: verify admin
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = !!body.dryRun;

    // Fetch all Shopify products (paginated)
    const groups = new Map<GroupKey, Group>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const data = await shopifyGraphQL(PRODUCTS_QUERY, { first: 100, cursor });
      pages++;
      for (const pe of data.products.edges) {
        const p = pe.node;
        const vendor = (p.vendor || "").trim() || "Unknown supplier";
        for (const ve of p.variants.edges) {
          const v = ve.node;
          const cost = parseFloat(v.inventoryItem?.unitCost?.amount || "0") || 0;
          const price = parseFloat(v.price || "0") || 0;
          const opts = v.selectedOptions || [];
          const color = opts.find((o: any) => /colou?r/i.test(o.name))?.value || null;
          const size = opts.find((o: any) => /size/i.test(o.name))?.value || null;
          const other = opts.filter((o: any) => !/colou?r|size/i.test(o.name)).map((o: any) => `${o.name}: ${o.value}`).join(", ") || null;
          for (const le of v.inventoryItem?.inventoryLevels?.edges || []) {
            const ln = le.node;
            const qty = (ln.quantities || []).find((q: any) => q.name === "available")?.quantity ?? 0;
            if (qty <= 0) continue;
            const locId = ln.location.id;
            const locName = ln.location.name;
            const key = `${vendor}__${locId}`;
            let g = groups.get(key);
            if (!g) {
              g = { vendor, locationId: locId, locationName: locName, products: new Map() };
              groups.set(key, g);
            }
            let prod = g.products.get(p.id);
            if (!prod) {
              prod = { title: p.title, image: p.featuredImage?.url || null, variants: [] };
              g.products.set(p.id, prod);
            }
            prod.variants.push({
              productId: p.id,
              productTitle: p.title,
              productImage: p.featuredImage?.url || null,
              variantId: v.id,
              variantTitle: v.title,
              sku: v.sku || null,
              price,
              cost,
              image: v.image?.url || p.featuredImage?.url || null,
              color, size, other,
              qty,
            });
          }
        }
      }
      cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
      if (pages > 50) break; // safety
    } while (cursor);

    // Duplicate check: for each group, look for existing draft POs with same vendor whose items overlap product IDs
    const preview: any[] = [];
    const toCreate: Group[] = [];
    const skipped: any[] = [];

    for (const g of groups.values()) {
      const productIds = Array.from(g.products.keys());
      const totalVariants = Array.from(g.products.values()).reduce((s, p) => s + p.variants.length, 0);
      const totalQty = Array.from(g.products.values()).reduce((s, p) => s + p.variants.reduce((ss, v) => ss + v.qty, 0), 0);

      const { data: existingPOs } = await admin
        .from("purchase_orders")
        .select("id, name")
        .eq("status", "draft")
        .eq("supplier_name", g.vendor);

      let dupPoId: string | null = null;
      let overlap = 0;
      if (existingPOs && existingPOs.length > 0) {
        const poIds = existingPOs.map((p: any) => p.id);
        const { data: dupItems } = await admin
          .from("purchase_order_items")
          .select("purchase_order_id, shopify_product_id")
          .in("purchase_order_id", poIds)
          .in("shopify_product_id", productIds);
        if (dupItems && dupItems.length > 0) {
          dupPoId = dupItems[0].purchase_order_id;
          overlap = new Set(dupItems.map((d: any) => d.shopify_product_id)).size;
        }
      }

      const row = {
        vendor: g.vendor,
        location: g.locationName,
        products: g.products.size,
        variants: totalVariants,
        totalQty,
        status: dupPoId ? "skipped" : "will_create",
        existingPoId: dupPoId,
        overlapCount: overlap,
      };
      preview.push(row);
      if (dupPoId) skipped.push(row);
      else toCreate.push(g);
    }

    if (dryRun) {
      return new Response(JSON.stringify({ dryRun: true, preview, skipped, wouldCreate: toCreate.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const created: string[] = [];

    for (const g of toCreate) {
      const poName = `Shopify import · ${g.vendor} · ${g.locationName} · ${today}`;
      const { data: po, error: poErr } = await admin
        .from("purchase_orders")
        .insert({
          owner_user_id: user.id,
          owner_role: "admin",
          name: poName,
          supplier_name: g.vendor,
          status: "draft",
          payment_status: "unpaid",
          notes: `Imported from Shopify on ${today}. Draft — fill customs cost and any missing fields before finalizing. Location: ${g.locationName}.`,
        })
        .select("id")
        .single();
      if (poErr || !po) { console.error("PO insert failed", poErr); continue; }

      for (const [productId, prod] of g.products.entries()) {
        const totalQty = prod.variants.reduce((s, v) => s + v.qty, 0);
        const avgCost = prod.variants.reduce((s, v) => s + v.cost * v.qty, 0) / (totalQty || 1);
        const avgPrice = prod.variants.reduce((s, v) => s + v.price * v.qty, 0) / (totalQty || 1);

        // Try to link seller_products
        let linkedId: string | null = null;
        const { data: sp } = await admin
          .from("seller_products")
          .select("id")
          .eq("shopify_product_id", productId)
          .maybeSingle();
        if (sp) linkedId = sp.id;

        const { data: item, error: itemErr } = await admin
          .from("purchase_order_items")
          .insert({
            purchase_order_id: po.id,
            product_name: prod.title,
            image_url: prod.image,
            brand: g.vendor,
            quantity_ordered: totalQty,
            cost_per_item: avgCost,
            selling_price: avgPrice,
            shopify_product_id: productId,
            shopify_sync_status: "imported_draft",
            source_type: "shopify",
            source_product_ref: productId,
            linked_seller_product_id: linkedId,
          })
          .select("id")
          .single();
        if (itemErr || !item) { console.error("Item insert failed", itemErr); continue; }

        if (prod.variants.length > 1 || (prod.variants[0] && (prod.variants[0].color || prod.variants[0].size))) {
          const variantRows = prod.variants.map((v) => ({
            item_id: item.id,
            shopify_variant_id: v.variantId,
            option_color: v.color,
            option_size: v.size,
            option_other: v.other,
            cost_per_item: v.cost,
            selling_price: v.price,
            quantity_ordered: v.qty,
            included: true,
          }));
          const { error: vErr } = await admin.from("purchase_order_item_variants").insert(variantRows);
          if (vErr) console.error("Variant insert failed", vErr);
        }
      }
      created.push(po.id);
    }

    return new Response(JSON.stringify({ created, skipped, preview }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("import-shopify-po-drafts error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
