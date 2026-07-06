import { defineMcp } from "@lovable.dev/mcp-js";
import searchProductsTool from "./tools/search-products";
import listSellersTool from "./tools/list-sellers";
import getPlatformInfoTool from "./tools/get-platform-info";

export default defineMcp({
  name: "luut-slu-mcp",
  title: "Luut SLU Marketplace",
  version: "0.1.0",
  instructions:
    "Tools for the Luut SLU marketplace (Saint Lucia). Use `search_products` to browse the catalog, `list_sellers` to discover verified sellers, and `get_platform_info` for payment/meetup/currency facts.",
  tools: [searchProductsTool, listSellersTool, getPlatformInfoTool],
});
