import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_platform_info",
  title: "Get platform info",
  description:
    "Return static facts about Luut SLU: payment model, meetup locations, categories, currency.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            name: "Luut SLU",
            country: "Saint Lucia",
            currency: "XCD (EC$)",
            paymentModel: "Pay on Meetup — cash at safe locations",
            meetupLocations: ["Castries", "Gros Islet", "Vieux Fort", "Rodney Bay"],
            categories: [
              "Beanies", "Hats", "Ski Masks", "Shirts/Tops", "Hoodies/Outerwear",
              "Pants/Bottoms", "Shorts", "Shoes/Footwear", "Bags/Backpacks",
              "Accessories", "Jewelry", "Watches", "Sunglasses",
            ],
            website: "https://luut-slu-supply.lovable.app",
          },
          null,
          2,
        ),
      },
    ],
  }),
});
