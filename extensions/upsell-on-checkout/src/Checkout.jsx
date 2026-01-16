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
      try {
        const response = await fetch(
          "https://misha-checkout-upsell-app.onrender.com/app/upsell-list",
        );

        if (!response.ok) {
          setError(`Помилка завантаження upsell-списку: ${response.status}`);
          setLoading(false);
          return;
        }

        const data = await response.json();
        setProductIds(data.productIds ?? []);
      } catch (err) {
        setError(`Помилка мережі: ${String(err)}`);
      } finally {
        setLoading(false);
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
        <s-text tone="subdued">
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
            borderWidth="small"
            borderColor="subdued"
            background="transparent"
          >
            <s-text size="small">{id}</s-text>
          </s-box>
        ))}
      </s-stack>
    </s-section>
  );
}