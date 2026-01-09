import React, {useState, useMemo} from "react";
import {useLoaderData, useFetcher} from "react-router";
import {boundary} from "@shopify/shopify-app-react-router/server";
import {authenticate} from "../shopify.server";
import prisma from "../db.server"; // ⚠️ default-імпорт, бо в db.server.js export default prisma

// Loader: тягнемо продукти з Admin GraphQL API + список upsell-ів з БД
export const loader = async ({request}) => {
  const {admin, session} = await authenticate.admin(request);
  const shop = session.shop; // типу "my-shop.myshopify.com"

  // 1) Продукти з Admin GraphQL
  const response = await admin.graphql(`#graphql
    query UpsellProductsListWithSearchAndPagination {
      products(first: 100, sortKey: TITLE) {
        edges {
          node {
            id
            title
            status
            featuredImage {
              url
              altText
            }
          }
        }
      }
    }
  `);

  const json = await response.json();
  const products = json.data.products.edges.map(({node}) => node);

  // 2) Upsell-продукти з БД для цього магазину
  const upsellRows = await prisma.upsellProduct.findMany({
    where: {shop},
  });

  const upsellProductIds = upsellRows.map((row) => row.productId);

  return {products, upsellProductIds};
};

// Action: додаємо/видаляємо продукти в upsell-списку в БД
export const action = async ({request}) => {
  const {session} = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("_intent");
  const productId = formData.get("productId");

  if (!productId || typeof productId !== "string") {
    return {error: "Missing productId"};
  }

  if (intent === "add") {
    try {
      await prisma.upsellProduct.create({
        data: {
          shop,
          productId,
        },
      });
    } catch (error) {
      // Якщо запис уже існує (через @@unique), просто ігноруємо
    }
    return {ok: true};
  }

  if (intent === "remove") {
    await prisma.upsellProduct.deleteMany({
      where: {
        shop,
        productId,
      },
    });
    return {ok: true};
  }

  return {error: "Unknown intent"};
};

export default function AppUpsells() {
  const {products, upsellProductIds} = useLoaderData();
  const fetcher = useFetcher();

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 5;

  // Фільтруємо продукти по назві та ID
  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;

    return products.filter((p) => {
      const title = p.title?.toLowerCase() || "";
      const id = p.id?.toLowerCase() || "";
      return title.includes(term) || id.includes(term);
    });
  }, [products, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  if (currentPage > pageCount) {
    setCurrentPage(pageCount);
  }

  const pagedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, currentPage]);

  const selectedProducts = useMemo(
    () => products.filter((p) => upsellProductIds.includes(p.id)),
    [products, upsellProductIds],
  );

  function submitChange({intent, productId}) {
    const form = new FormData();
    form.append("_intent", intent);
    form.append("productId", productId);
    fetcher.submit(form, {method: "post"});
  }

  function goToPreviousPage() {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }

  function goToNextPage() {
    setCurrentPage((prev) => Math.min(pageCount, prev + 1));
  }

  return (
    <s-page heading="Upsell products">
      <s-section heading="Пошук і вибір продуктів для апсела">
        <s-paragraph>
          Використовуй пошук, щоб знайти продукт за назвою або ID, і додай його
          в upsell одним кліком. Список відображає по 5 продуктів на сторінку.
        </s-paragraph>

        <s-stack direction="block" gap="base">
          <s-search-field
            label="Пошук продуктів"
            value={searchTerm}
            onInput={(event) => {
              setSearchTerm(event.currentTarget.value);
              setCurrentPage(1);
            }}
            placeholder="Введи назву або ID продукту"
          />

          <s-text tone="subdued">
            Всього продуктів: {products.length}, після фільтрації:{" "}
            {filteredProducts.length}
          </s-text>

          {filteredProducts.length === 0 ? (
            <s-paragraph tone="warning">
              Нічого не знайдено. Спробуй змінити запит.
            </s-paragraph>
          ) : (
            <>
              <s-stack direction="block" gap="small">
                {pagedProducts.map((product) => {
                  const isSelected = upsellProductIds.includes(product.id);
                  const img = product.featuredImage;

                  return (
                    <s-box
                      key={product.id}
                      padding="large"
                      borderRadius="base"
                      borderWidth="small"
                      borderColor="subdued"
                      background="transparent"
                    >
                      {/* Верхній блок: картинка + назва + статус */}
                      <s-stack
                        direction="inline"
                        gap="base"
                        alignItems="center"
                      >
                        {img ? (
                          <s-thumbnail
                            size="small"
                            src={img.url}
                            alt={img.altText || product.title}
                          />
                        ) : (
                          <s-thumbnail size="small" alt={product.title} />
                        )}

                        <s-text>{product.title}</s-text>
                        <s-badge tone="auto" color="subdued">
                          {product.status}
                        </s-badge>
                      </s-stack>

                      {/* Відступ над кнопкою */}
                      <div style={{marginTop: "0.75rem"}}>
                        <s-button
                          variant={isSelected ? "tertiary" : "primary"}
                          onClick={() =>
                            submitChange({
                              intent: isSelected ? "remove" : "add",
                              productId: product.id,
                            })
                          }
                        >
                          {isSelected ? "Remove from upsell" : "Add to upsell"}
                        </s-button>
                      </div>
                    </s-box>
                  );
                })}
              </s-stack>

              <s-stack
                direction="inline"
                gap="base"
                alignItems="center"
                justifyContent="space-between"
              >
                <s-text tone="subdued">
                  Сторінка {currentPage} з {pageCount}
                </s-text>
                <s-stack direction="inline" gap="base">
                  <s-button
                    variant="tertiary"
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </s-button>
                  <s-button
                    variant="tertiary"
                    onClick={goToNextPage}
                    disabled={currentPage === pageCount}
                  >
                    Next
                  </s-button>
                </s-stack>
              </s-stack>
            </>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Обрані upsell продукти (збережені в БД)">
        {selectedProducts.length === 0 ? (
          <s-paragraph tone="subdued">
            Поки що ти не вибрав жодного продукту для апсела.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="small">
            {selectedProducts.map((product) => {
              const img = product.featuredImage;
              return (
                <s-box
                  key={product.id}
                  padding="large"
                  borderRadius="base"
                  borderWidth="small"
                  borderColor="subdued"
                  background="transparent"
                >
                  <s-stack
                    direction="inline"
                    gap="base"
                    alignItems="center"
                  >
                    {img ? (
                      <s-thumbnail
                        size="small"
                        src={img.url}
                        alt={img.altText || product.title}
                      />
                    ) : (
                      <s-thumbnail size="small" alt={product.title} />
                    )}

                    <s-text>{product.title}</s-text>
                    <s-badge tone="auto" color="subdued">
                      {product.status}
                    </s-badge>
                  </s-stack>

                  <div style={{marginTop: "0.75rem"}}>
                    <s-button
                      destructive
                      onClick={() =>
                        submitChange({
                          intent: "remove",
                          productId: product.id,
                        })
                      }
                    >
                      Remove
                    </s-button>
                  </div>
                </s-box>
              );
            })}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};