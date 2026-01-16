import prisma from "../db.server";

// У DEV-варіанті беремо shop жорстко (один dev-store)
const DEV_SHOP = "misha-checkout-upsell-app.myshopify.com";

// GET /app/upsell-list
export const loader = async () => {
  console.log("HIT /app/upsell-list loader (no auth)");

  const shop = DEV_SHOP;

  const upsellRows = await prisma.upsellProduct.findMany({
    where: {shop},
  });

  const productIds = upsellRows.map((row) => row.productId);

  return new Response(JSON.stringify({productIds}), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};

export default function UpsellListApi() {
  // API-роут, UI не рендеримо
  return null;
}