import { Link, useParams } from "@remix-run/react";
import { useEffect, useState } from "react";

import { fetchItemByKey } from "../lib/api";
import { useAppState } from "../lib/app-state";
import { describeRestaurant } from "../lib/restaurants";
import { isReasonableItem, money } from "../lib/scoring";
import type { MenuItem } from "../lib/types";

export default function MealRoute() {
  const { mealKey = "" } = useParams();
  const decodedKey = decodeURIComponent(mealKey);
  const { compareKeys, toggleCompare, savedKeys, toggleSaved } = useAppState();
  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const loaded = await fetchItemByKey(decodedKey);
        setItem(isReasonableItem(loaded) ? loaded : null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load meal");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [decodedKey]);

  const isCompared = compareKeys.includes(decodedKey);
  const isSaved = savedKeys.includes(decodedKey);

  return (
    <main className="container detail-page">
      {loading ? <div className="loading-card">Loading meal details...</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {item ? (
        <>
          <div className="detail-hero">
            <div>
              <p className="eyebrow">{item.restaurant_name}</p>
              <h1>{item.item_name}</h1>
              <p>
                {item.category || "uncategorized"}
                {item.portion ? ` | ${item.portion}` : ""}
              </p>
              <p>{item.description || describeRestaurant(item.restaurant_id, item.restaurant_name)}</p>
            </div>
            <div className="detail-actions">
              <Link to={`/restaurants/${item.restaurant_id}`} className="ghost-pill">
                Restaurant page
              </Link>
              <button
                type="button"
                className="primary-pill"
                onClick={() => toggleCompare(item.unique_key)}
              >
                {isCompared ? "Remove compare" : "Add compare"}
              </button>
            </div>
          </div>

          <section className="detail-grid">
            <article className="section-shell">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Price</p>
                  <h2>{money(item.price_cad)}</h2>
                </div>
                <button
                  type="button"
                  className="ghost-pill item-save-pill"
                  onClick={() => toggleSaved(item.unique_key)}
                >
                  {isSaved ? "Saved" : "Save meal"}
                </button>
              </div>

              <div className="macro-grid">
                <div className="macro-box">
                  <span>Calories</span>
                  <strong>{item.macros?.calories ?? 0}</strong>
                </div>
                <div className="macro-box">
                  <span>Protein</span>
                  <strong>{item.macros?.protein_g ?? 0}g</strong>
                </div>
                <div className="macro-box">
                  <span>Carbs</span>
                  <strong>{item.macros?.carbs_g ?? 0}g</strong>
                </div>
                <div className="macro-box">
                  <span>Fat</span>
                  <strong>{item.macros?.fat_g ?? 0}g</strong>
                </div>
                <div className="macro-box">
                  <span>Sodium</span>
                  <strong>{item.macros?.sodium_mg ?? 0}mg</strong>
                </div>
                <div className="macro-box">
                  <span>Sugar</span>
                  <strong>{item.macros?.sugar_g ?? 0}g</strong>
                </div>
              </div>
            </article>

            <article className="section-shell">
              <div className="section-head">
                <div>
                  <p className="eyebrow">About this meal</p>
                  <h2>What matters here</h2>
                </div>
              </div>
              <div className="source-list">
                <div>
                  <strong>Restaurant</strong>
                  <p>{item.restaurant_name}</p>
                </div>
                <div>
                  <strong>Portion</strong>
                  <p>{item.portion || "Standard item"}</p>
                </div>
                <div>
                  <strong>Category</strong>
                  <p>{item.category || "Uncategorized"}</p>
                </div>
                {item.description ? (
                  <div>
                    <strong>Quick summary</strong>
                    <p>{item.description}</p>
                  </div>
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </main>
  );
}
