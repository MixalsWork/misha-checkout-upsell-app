import prisma from "../db.server";

// У DEV-варіанті беремо один конкретний магазину
const DEV_SHOP = "misha-checkout-upsell-app.myshopify.com";

// GET /upsell-list-api
export const loader = async () => {
  console.log("HIT /upsell-list-api loader");

  const upsellRows = await prisma.upsellProduct.findMany({
    where: {shop: DEV_SHOP},
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
  return null;
}