import prisma from "../db.server";
import {authenticate} from "../shopify.server";

// GET /app/upsell-list
export const loader = async ({request}) => {
  const {session} = await authenticate.admin(request);
  const shop = session.shop;

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