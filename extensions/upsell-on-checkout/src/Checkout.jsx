import "@shopify/ui-extensions/preact";
import {render} from "preact";
import {useEffect, useState} from "preact/hooks";

// Entry point: Shopify викликає default export
export default function () {
  render(<Extension />, document.body);
}

function Extension() {
  const [productIds, setProductIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      // Отримуємо shopify API з globalThis
      // eslint-disable-next-line no-undef
      const shopify = typeof globalThis !== "undefined" ? globalThis.shopify : undefined;
      
      console.log("🚀 [Checkout Extension] Starting data fetch");
      console.log("   Shopify API available:", !!shopify);
      console.log("   Shopify query available:", !!shopify?.query);

      // Варіант 1: Спробуємо використати Shopify query API для читання metafields
      // Це працює без CORS проблем, бо йде через Shopify infrastructure
      if (shopify?.query) {
        try {
          console.log("📤 [Checkout Extension] Trying Shopify query API (metafields)");
          
          const result = await shopify.query(
            `#graphql
              query GetUpsellProducts {
                shop {
                  metafield(namespace: "upsell", key: "products") {
                    value
                  }
                }
              }
            `
          );

          console.log("✅ [Checkout Extension] Query API result:", result);
          
          // Отримуємо значення metafield
          const resultData = result && typeof result === 'object' && 'data' in result ? result.data : null;
          const shopData = resultData && typeof resultData === 'object' && 'shop' in resultData ? resultData.shop : null;
          const metafield = shopData && typeof shopData === 'object' && 'metafield' in shopData ? shopData.metafield : null;
          const metafieldValue = metafield && typeof metafield === 'object' && 'value' in metafield ? metafield.value : null;
          
          if (metafieldValue && typeof metafieldValue === 'string') {
            try {
              const parsed = JSON.parse(metafieldValue);
              const ids = parsed.productIds || [];
              console.log("✅ [Checkout Extension] Got product IDs from metafield:", ids);
              setProductIds(ids);
              setLoading(false);
              return;
            } catch (parseErr) {
              console.error("❌ [Checkout Extension] Failed to parse metafield:", parseErr);
            }
          } else {
            console.log("⚠️ [Checkout Extension] No metafield found, using fetch fallback");
          }
        } catch (queryErr) {
          console.error("❌ [Checkout Extension] Query API error:", queryErr);
          // Продовжуємо з fetch
        }
      }

      // Варіант 2: Fallback - використовуємо fetch до нашого API
      // Спочатку пробуємо відносний URL (через Shopify infrastructure)
      const urlsToTry = [
        "/app/upsells/api", // Відносний URL через Shopify
        "https://misha-checkout-upsell-app.onrender.com/app/upsells/api", // Абсолютний URL
      ];
      
      for (const url of urlsToTry) {
        try {
          console.log("📤 [Checkout Extension] Trying fetch to:", url);
          
          const response = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
          });

          console.log("📥 [Checkout Extension] Response status:", response.status);
          console.log("   Response OK:", response.ok);

          if (!response.ok) {
            console.error("❌ [Checkout Extension] Response not OK:", response.status);
            if (url !== urlsToTry[urlsToTry.length - 1]) {
              continue; // Спробуємо наступний URL
            }
            setError(`Помилка завантаження upsell-списку: ${response.status}`);
            setLoading(false);
            return;
          }

          const data = await response.json();
          console.log("✅ [Checkout Extension] Got data:", data);
          setProductIds(data.productIds ?? []);
          setLoading(false);
          return; // Успішно отримали дані
          
        } catch (err) {
          console.error("❌ [Checkout Extension] Fetch error for", url, ":", err);
          if (url === urlsToTry[urlsToTry.length - 1]) {
            // Останній URL не спрацював
            setError(`Помилка мережі: ${String(err)}`);
            setLoading(false);
            return;
          }
          // Спробуємо наступний URL
        }
      }
    })();
  }, []);

  if (loading) {
    return (
      <s-section heading="Upsell products">
        <s-text>Завантажуємо продукти для апсела...</s-text>
      </s-section>
    );
  }

  if (error) {
    return (
      <s-section heading="Upsell products">
        <s-text tone="critical">{error}</s-text>
      </s-section>
    );
  }

  if (productIds.length === 0) {
    return (
      <s-section heading="Upsell products">
        <s-text>
          Наразі немає налаштованих upsell-продуктів. Додай їх в адмінці апки.
        </s-text>
      </s-section>
    );
  }

  return (
    <s-section heading="Upsell products">
      <s-stack direction="block" gap="small">
        <s-text>
          Знайдено {productIds.length} upsell-продукт(и) (поки що показуємо
          тільки ID):
        </s-text>

        {productIds.map((id) => (
          <s-box
            key={id}
            padding="base"
            borderRadius="base"
            background="transparent"
          >
            <s-text>{id}</s-text>
          </s-box>
        ))}
      </s-stack>
    </s-section>
  );
}