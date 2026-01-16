import prisma from "../db.server";
import {authenticate} from "../shopify.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
  "Access-Control-Allow-Credentials": "false",
  "Access-Control-Max-Age": "86400",
};

// Обробка OPTIONS (preflight)
export const action = async ({request}) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  
  return new Response(
    JSON.stringify({error: `Method ${request.method} not allowed`}),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    },
  );
};

// GET /app/upsells/api - повертає список upsell product IDs
export const loader = async ({request}) => {
  // Обробка OPTIONS (preflight) в loader
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "GET") {
    return new Response(
      JSON.stringify({error: `Method ${request.method} not allowed. Use GET.`}),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  try {
    // Спробуємо аутентифікувати через checkout (для extension)
    let shop = null;
    let cors = null;
    
    try {
      const authResult = await authenticate.public.checkout(request);
      shop = authResult.sessionToken?.shop || null;
      cors = authResult.cors;
    } catch (checkoutError) {
      // Fallback: спробуємо admin auth (для тестування)
      try {
        const {session} = await authenticate.admin(request);
        shop = session.shop;
      } catch (adminError) {
        // Для dev використовуємо жорстко закодований shop
        shop = "misha-checkout-upsell-app.myshopify.com";
      }
    }

    if (!shop) {
      shop = "misha-checkout-upsell-app.myshopify.com";
    }

    // Отримуємо upsell products з БД
    const upsellRows = await prisma.upsellProduct.findMany({
      where: {shop},
    });

    const productIds = upsellRows.map((row) => row.productId);

    const response = new Response(JSON.stringify({productIds}), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

    // Використовуємо cors helper якщо доступний
    if (cors) {
      return cors(response);
    }

    return response;
  } catch (error) {
    console.error("❌ [app/upsells/api] Error:", error);
    
    // Fallback: повертаємо дані навіть якщо аутентифікація не спрацювала
    const shop = "misha-checkout-upsell-app.myshopify.com";
    const upsellRows = await prisma.upsellProduct.findMany({
      where: {shop},
    });

    const productIds = upsellRows.map((row) => row.productId);

    return new Response(JSON.stringify({productIds}), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
};

export const headers = () => {
  return corsHeaders;
};

export default function UpsellsApi() {
  return null;
}
