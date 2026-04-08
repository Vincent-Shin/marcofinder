import { Link, useNavigate, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";

import { fetchItems, fetchRestaurants } from "../lib/api";
import { useAppState } from "../lib/app-state";
import { getCategoryMeta, normalizeCategory } from "../lib/catalog";
import { describeRestaurant } from "../lib/restaurants";
import { compactMacros, isReasonableItem, money, proteinValue } from "../lib/scoring";
import type { MenuItem, RestaurantSummary } from "../lib/types";

export default function RestaurantRoute() {
  const navigate = useNavigate();
  const { restaurantId = "" } = useParams();
  const { compareKeys, toggleCompare, savedKeys, toggleSaved } = useAppState();
  const [restaurant, setRestaurant] = useState<RestaurantSummary | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [restaurantsResponse, itemsResponse] = await Promise.all([
          fetchRestaurants(),
          fetchItems({ restaurantId, pricedOnly: true, limit: 5000 }),
        ]);
        setRestaurant(
          restaurantsResponse.find((entry) => entry.restaurant_id === restaurantId) ||
            null,
        );
        setItems(itemsResponse.items.filter(isReasonableItem));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load restaurant",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [restaurantId]);

  const topItems = useMemo(
    () => [...items].sort((left, right) => proteinValue(right) - proteinValue(left)),
    [items],
  );

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = normalizeCategory(item.category);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const topCategories = [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([key]) => getCategoryMeta(key).label.toLowerCase());

    const avgPrice =
      items.reduce((sum, item) => sum + (item.price_cad || 0), 0) / (items.length || 1);

    return {
      topCategories,
      avgPrice,
    };
  }, [items]);

  return (
    <main className="container detail-page">
      <div className="detail-hero">
        <div>
          <p className="eyebrow">Restaurant</p>
          <h1>{restaurant?.restaurant_name || restaurantId}</h1>
          <p>
            {restaurant
              ? `${restaurant.priced_count}/${restaurant.item_count} items currently priced. Best known here for ${summary.topCategories.join(", ") || "restaurant staples"}.`
              : "Loading restaurant summary"}
          </p>
          <p>{describeRestaurant(restaurantId, restaurant?.restaurant_name)}</p>
          {summary.topCategories.length ? (
            <div className="macro-row">
              {summary.topCategories.map((entry) => (
                <span key={entry}>{entry}</span>
              ))}
              <span>avg. {money(summary.avgPrice)}</span>
            </div>
          ) : null}
        </div>
        <Link to="/discover" className="ghost-pill">
          Back to discover
        </Link>
      </div>

      {loading ? <div className="loading-card">Loading restaurant menu...</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="section-shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Menu</p>
            <h2>Best value items first</h2>
          </div>
          <p>{items.length} priced items</p>
        </div>

        <div className="list-shell">
          {topItems.map((item) => {
            const isCompared = compareKeys.includes(item.unique_key);
            const isSaved = savedKeys.includes(item.unique_key);
            return (
              <article key={item.unique_key} className="list-card">
                <button
                  type="button"
                  className="list-main"
                  onClick={() =>
                    navigate(`/meals/${encodeURIComponent(item.unique_key)}`)
                  }
                >
                  <div>
                    <h3>{item.item_name}</h3>
                    <p>{item.category || "uncategorized"}</p>
                    {item.description ? (
                      <p className="list-description">{item.description}</p>
                    ) : null}
                  </div>
                  <div className="list-metrics">
                    <strong>{money(item.price_cad)}</strong>
                    <span>{proteinValue(item).toFixed(2)} g/$</span>
                  </div>
                </button>

                <div className="macro-row">
                  {compactMacros(item).map((macro) => (
                    <span key={macro}>{macro}</span>
                  ))}
                </div>

                <div className="card-actions">
                  <button
                    type="button"
                    className="ghost-pill item-save-pill"
                    onClick={() => toggleSaved(item.unique_key)}
                  >
                    {isSaved ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="primary-pill"
                    onClick={() => toggleCompare(item.unique_key)}
                  >
                    {isCompared ? "Remove compare" : "Add compare"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
