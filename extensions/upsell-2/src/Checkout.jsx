import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useEffect, useState} from "preact/hooks";

// Entry point: Shopify викликає default export
export default function () {
  render(<Extension />, document.body);
}

function Extension() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState({});

  // Отримуємо shopify API з globalThis
  // eslint-disable-next-line no-undef
  const shopify = typeof globalThis !== "undefined" ? globalThis.shopify : undefined;

  useEffect(() => {
    (async () => {
      try {
        console.log("🚀 [Checkout Extension] Starting...");
        
        if (!shopify?.query) {
          throw new Error("Shopify query API not available");
        }

        // Отримуємо product IDs з metafield
        console.log("📤 [Checkout Extension] Getting product IDs from metafield");
        
        const metafieldResult = await shopify.query(
          `#graphql
            query GetUpsellProductIds {
              shop {
                metafield(namespace: "upsell", key: "products") {
                  value
                }
              }
            }
          `
        );

        const resultData = metafieldResult && typeof metafieldResult === 'object' && 'data' in metafieldResult ? metafieldResult.data : null;
        const shopData = resultData && typeof resultData === 'object' && 'shop' in resultData ? resultData.shop : null;
        const metafield = shopData && typeof shopData === 'object' && 'metafield' in shopData ? shopData.metafield : null;
        const metafieldValue = metafield && typeof metafield === 'object' && 'value' in metafield ? metafield.value : null;
        
        if (!metafieldValue || typeof metafieldValue !== 'string') {
          console.log("⚠️ [Checkout Extension] No metafield found");
          setProducts([]);
          setLoading(false);
          return;
        }

        const parsed = JSON.parse(metafieldValue);
        const productIds = parsed.productIds || [];
        
        console.log("📋 [Checkout Extension] Parsed metafield value:", parsed);
        console.log("📋 [Checkout Extension] Product IDs array:", productIds);
        console.log("📋 [Checkout Extension] Product IDs count:", productIds.length);
        
        if (productIds.length === 0) {
          console.log("⚠️ [Checkout Extension] No product IDs in metafield");
          setProducts([]);
          setLoading(false);
          return;
        }

        console.log("✅ [Checkout Extension] Got product IDs:", productIds);

        // Отримуємо детальну інформацію про продукти
        console.log("📤 [Checkout Extension] Fetching product details for", productIds.length, "products");
        
        const productsResult = await shopify.query(
          `#graphql
            query GetProducts($ids: [ID!]!) {
              nodes(ids: $ids) {
                ... on Product {
                  id
                  title
                  featuredImage {
                    url
                    altText
                  }
                  variants(first: 10) {
                    nodes {
                      id
                      price {
                        amount
                        currencyCode
                      }
                      availableForSale
                    }
                  }
                }
              }
            }
          `,
          {
            variables: {
              ids: productIds,
            },
          }
        );

        const productsData = productsResult && typeof productsResult === 'object' && 'data' in productsResult ? productsResult.data : null;
        const nodes = productsData && typeof productsData === 'object' && 'nodes' in productsData ? productsData.nodes : null;
        
        console.log("📋 [Checkout Extension] Products query result:", JSON.stringify(productsResult, null, 2));
        console.log("📋 [Checkout Extension] Products data:", productsData);
        console.log("📋 [Checkout Extension] Nodes:", nodes);
        
        const nodesArray = Array.isArray(nodes) ? nodes : [];
        const validProducts = nodesArray.filter(node => node !== null && node !== undefined && node.id);
        
        console.log("✅ [Checkout Extension] Got products:", validProducts.length);
        console.log("📋 [Checkout Extension] Valid products:", validProducts.map(p => ({
          id: p.id, 
          title: p.title,
          variantsCount: p.variants?.nodes?.length || 0,
          availableVariants: p.variants?.nodes?.filter(v => v.availableForSale).length || 0
        })));
        
        // Фільтруємо продукти, які мають хоча б один доступний варіант
        const productsWithAvailableVariants = validProducts.filter(product => {
          const hasAvailableVariant = product.variants?.nodes?.some(v => v.availableForSale) || false;
          if (!hasAvailableVariant) {
            console.log("⚠️ [Checkout Extension] Product has no available variants:", product.id, product.title);
          }
          return hasAvailableVariant;
        });
        
        console.log("✅ [Checkout Extension] Products with available variants:", productsWithAvailableVariants.length);
        setProducts(productsWithAvailableVariants);
      } catch (err) {
        console.error("❌ [Checkout Extension] Error:", err);
        setError(`Помилка: ${String(err)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [shopify]);

  // Функція для додавання продукту в корзину
  const handleAddToCart = async (variantId, productId) => {
    if (!shopify?.applyCartLinesChange) {
      console.error("❌ applyCartLinesChange not available");
      return;
    }

    setAdding({...adding, [productId]: true});

    try {
      const result = await shopify.applyCartLinesChange({
        type: 'addCartLine',
        merchandiseId: variantId,
        quantity: 1,
      });

      console.log("✅ [Checkout Extension] Add to cart result:", result);

      if (result.type === 'error') {
        console.error("❌ [Checkout Extension] Add to cart error:", result.message);
        setError(`Помилка додавання в корзину: ${result.message}`);
      }
    } catch (err) {
      console.error("❌ [Checkout Extension] Add to cart error:", err);
      setError(`Помилка: ${String(err)}`);
    } finally {
      setAdding({...adding, [productId]: false});
    }
  };

  if (loading) {
    return (
      <s-section heading="Upsell Products">
        <s-text>Завантажуємо продукти...</s-text>
      </s-section>
    );
  }

  if (error) {
    return (
      <s-section heading="Upsell Products">
        <s-text tone="critical">{error}</s-text>
      </s-section>
    );
  }

  if (products.length === 0) {
    return (
      <s-section heading="Upsell Products">
        <s-text>Немає upsell продуктів. Додай їх в адмінці.</s-text>
      </s-section>
    );
  }

  return (
    <s-section heading="You might also like">
      <s-stack direction="block" gap="base">
        {products.map((product) => {
          // Знаходимо перший доступний варіант
          const variant = product.variants?.nodes?.find(v => v.availableForSale) || product.variants?.nodes?.[0];
          const isAdding = adding[product.id] || false;

          if (!variant) {
            console.log("⚠️ [Checkout Extension] No variant found for product:", product.id);
            return null;
          }

          const price = parseFloat(variant.price.amount);
          const formattedPrice = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: variant.price.currencyCode,
          }).format(price);

          return (
            <s-box
              key={product.id}
              padding="base"
              borderRadius="base"
              borderWidth="base"
            >
              <s-stack direction="block" gap="small">
                <s-stack direction="block" gap="none">
                  <s-text>{product.title}</s-text>
                  <s-text tone="auto">{formattedPrice}</s-text>
                </s-stack>
                <s-button
                  variant="primary"
                  onClick={() => handleAddToCart(variant.id, product.id)}
                  loading={isAdding}
                  disabled={isAdding}
                >
                  {isAdding ? "Adding..." : "Add to cart"}
                </s-button>
              </s-stack>
            </s-box>
          );
        })}
      </s-stack>
    </s-section>
  );
}